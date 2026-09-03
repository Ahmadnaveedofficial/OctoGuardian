import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    this.logger.error('Unhandled Exception occurred:', exception);

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorMessage = 'Internal server error';

    /*
     * 1. NestJS HttpException
     */
    if (exception instanceof HttpException) {
      status = exception.getStatus();

      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        errorMessage = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const responseBody = exceptionResponse as Record<string, any>;

        if (Array.isArray(responseBody.message)) {
          errorMessage = responseBody.message.join(', ');
        } else if (responseBody.message) {
          errorMessage = String(responseBody.message);
        } else if (responseBody.error) {
          errorMessage = String(responseBody.error);
        }
      }
    }

    /*
     * 2. MongoDB Duplicate Key Error
     */
    else if ((exception as any)?.code === 11000) {
      status = HttpStatus.CONFLICT;

      const field =
        Object.keys((exception as any).keyPattern || {})[0] || 'Field';

      errorMessage = `${field} already exists`;
    }

    /*
     * 3. Mongoose Validation Error
     */
    else if ((exception as any)?.name === 'ValidationError') {
      status = HttpStatus.BAD_REQUEST;
      errorMessage = (exception as any).message;
    }

    /*
     * 4. Error / Octokit / GitHub Errors
     */
    else if (exception instanceof Error) {
      const githubError = exception as any;

      /*
       * Octokit gives us the HTTP status directly.
       */
      if (githubError.status) {
        status = Number(githubError.status);
      }

      /*
       * GitHub/Octokit usually contains the useful information
       * inside exception.response.data.
       */
      const githubData = githubError?.response?.data;

      if (githubData) {
        /*
         * Example:
         *
         * {
         *   message: "Validation Failed",
         *   errors: [
         *     {
         *       resource: "Label",
         *       code: "already_exists",
         *       field: "name"
         *     }
         *   ]
         * }
         */

        if (Array.isArray(githubData.errors) && githubData.errors.length > 0) {
          const firstError = githubData.errors[0];

          const resource = firstError.resource || 'Resource';
          const code = firstError.code || 'error';
          const field = firstError.field || 'field';

          if (code === 'already_exists') {
            errorMessage = `${resource} with ${field} already exists.`;
          } else {
            errorMessage = `GitHub validation error: ${resource} ${field} ${code.replace(/_/g, ' ')}.`;
          }
        } else if (githubData.message) {
          errorMessage = `GitHub Error: ${githubData.message}`;
        } else {
          errorMessage = exception.message;
        }
      } else {
        /*
         * Fallback for normal JavaScript errors.
         */
        errorMessage = exception.message;
      }

      /*
       * 5. Handle errors where GitHub JSON is embedded
       * inside exception.message.
       */
      if (
        errorMessage === exception.message &&
        exception.message.includes('Validation Failed')
      ) {
        try {
          const jsonMatch = exception.message.match(/\{[\s\S]*\}/);

          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);

            if (Array.isArray(parsed.errors) && parsed.errors.length > 0) {
              const firstError = parsed.errors[0];

              const resource = firstError.resource || 'Resource';
              const code = firstError.code || 'error';
              const field = firstError.field || 'field';

              if (code === 'already_exists') {
                errorMessage = `${resource} with ${field} already exists.`;
              } else {
                errorMessage = `GitHub validation error: ${resource} ${field} ${code.replace(/_/g, ' ')}.`;
              }
            } else if (parsed.message) {
              errorMessage = `GitHub Error: ${parsed.message}`;
            }
          }
        } catch {
          errorMessage = exception.message;
        }
      }
    }

    /*
     * Final log
     */
    this.logger.error(
      `[${request.method}] ${request.url} -> ${status}: ${errorMessage}`,
    );

    /*
     * Response sent to frontend
     */
    response.status(status).json({
      success: false,
      statusCode: status,
      message: errorMessage,
      error: errorMessage,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
