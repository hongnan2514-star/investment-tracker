// models/User.ts
import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  avatarUrl: { type: String, default: '' },
  passwordHash: { type: String }, // 允许为空，表示尚未设置密码
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export default mongoose.models.User || mongoose.model('User', UserSchema);