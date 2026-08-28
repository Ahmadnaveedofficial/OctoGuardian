import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  UnauthorizedException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import 'multer';
import { UsersService } from './users.service';
import { PasswordService } from '../auth/password/password.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UserDocument } from './schemas/user.schema';
import { UpdateAccountDto } from './dto/update-account.dto';
import { AccountActionDto } from './dto/account-action.dto';

@ApiTags('Users Endpoints')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly passwordService: PasswordService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Get('check-username')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check if username is available' })
  @ApiQuery({ name: 'username', required: true, type: String })
  async checkUsername(@Query('username') username: string) {
    const user = await this.usersService.findByUsername(username);
    return { available: !user };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  getProfile(@CurrentUser() user: UserDocument) {
    return this.usersService.toUserResponse(user);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('update-details')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update user account details' })
  async updateDetails(
    @CurrentUser() user: UserDocument,
    @Body() dto: UpdateAccountDto,
  ) {
    const updatePayload = {
      ...dto,
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
    };

    const updated = await this.usersService.updateById(
      user._id.toString(),
      updatePayload,
    );
    return this.usersService.toUserResponse(updated!);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('update-avatar')
  @UseInterceptors(FileInterceptor('avatar'))
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload or update avatar image on Cloudinary' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        avatar: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async updateAvatar(
    @CurrentUser() user: UserDocument,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (user.avatarPublicId) {
      await this.cloudinaryService.deleteImage(user.avatarPublicId);
    }
    const uploaded = await this.cloudinaryService.uploadImage(file);
    const updated = await this.usersService.updateById(user._id.toString(), {
      avatar: uploaded.secure_url,
      avatarPublicId: uploaded.public_id,
    });
    return this.usersService.toUserResponse(updated!);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('deactivate-account')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate current user account' })
  async deactivateAccount(
    @CurrentUser() user: UserDocument,
    @Body() dto: AccountActionDto,
  ) {
    const fullUser = await this.usersService.findByIdWithPassword(
      user._id.toString(),
    );
    const isMatch = await this.passwordService.compare(
      dto.password,
      fullUser!.password,
    );
    if (!isMatch) throw new UnauthorizedException('Password validation failed');

    await this.usersService.updateById(user._id.toString(), {
      isActive: false,
      deactivatedAt: new Date(),
      refreshTokenHash: null,
    });
    return { message: 'Account deactivated' };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Delete('delete-account')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Permanently delete user account and clean up assets',
  })
  async deleteAccount(
    @CurrentUser() user: UserDocument,
    @Body() dto: AccountActionDto,
  ) {
    const fullUser = await this.usersService.findByIdWithPassword(
      user._id.toString(),
    );
    const isMatch = await this.passwordService.compare(
      dto.password,
      fullUser!.password,
    );
    if (!isMatch) throw new UnauthorizedException('Password validation failed');

    if (user.avatarPublicId) {
      await this.cloudinaryService.deleteImage(user.avatarPublicId);
    }
    await this.usersService.deleteById(user._id.toString());
    return { message: 'Account deleted permanently' };
  }
}
