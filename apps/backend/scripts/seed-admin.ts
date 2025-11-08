import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument, UserRole, UserStatus } from '../src/users/schemas/user.schema';

const SALT_ROUNDS = 12;

async function main() {
  console.log('⚙️  Bootstrapping Nest app...');
  const app = await NestFactory.createApplicationContext(AppModule);
  console.log('✅ App context created.\n');

  const userModel = app.get<Model<UserDocument>>(getModelToken(User.name));

  // Admin credentials
  const adminEmail = 'admin@example.com';
  const adminPassword = 'Admin123!';

  console.log('🔍 Checking if admin user already exists...');
  const existingAdmin = await userModel.findOne({
    email: adminEmail.toLowerCase().trim(),
    deletedAt: null
  }).exec();

  if (existingAdmin) {
    console.log('⚠️  Admin user already exists!');
    console.log('📧 Email:', existingAdmin.email);
    console.log('👤 Name:', existingAdmin.firstName, existingAdmin.lastName);
    console.log('🎭 Role:', existingAdmin.role);
    console.log('📊 Status:', existingAdmin.status);
    console.log('\n💡 If you forgot the password, delete this user from MongoDB and run the seed script again.\n');
  } else {
    console.log('➕ Creating admin user...');

    const passwordHash = await bcrypt.hash(adminPassword, SALT_ROUNDS);

    const admin = await userModel.create({
      email: adminEmail.toLowerCase().trim(),
      passwordHash,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      firstName: 'Admin',
      lastName: 'User',
    });

    console.log('✅ Admin user created successfully!\n');
    console.log('═══════════════════════════════════════');
    console.log('         🔐 ADMIN CREDENTIALS         ');
    console.log('═══════════════════════════════════════');
    console.log('📧 Email:    ', adminEmail);
    console.log('🔑 Password: ', adminPassword);
    console.log('🎭 Role:     ', admin.role);
    console.log('📊 Status:   ', admin.status);
    console.log('═══════════════════════════════════════');
    console.log('\n💡 Use these credentials to log in at: http://localhost:3000/login\n');
  }

  await app.close();
  console.log('🏁 Done.');
}

main().catch((e) => {
  console.error('❌ Error in seed-admin script:', e);
  process.exit(1);
});
