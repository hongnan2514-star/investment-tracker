import mongoose from 'mongoose';

const OtpSchema = new mongoose.Schema({
  phoneNumber: { type: String, required: true },
  otp: { type: String, required: true }, // 这里建议存储哈希值，为简化先用明文
  createdAt: { 
    type: Date, 
    expires: 600, // 600秒 = 10分钟后自动删除
    default: Date.now 
  },
});

export default mongoose.models.Otp || mongoose.model('Otp', OtpSchema);