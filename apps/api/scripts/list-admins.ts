import mongoose from 'mongoose'

const MONGO_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27018/pba_dev'
await mongoose.connect(MONGO_URI)

const users = await mongoose.connection.db!
  .collection('users')
  .find({ role: { $in: ['ADMIN', 'SUPER_ADMIN'] } }, { projection: { email: 1, firstName: 1, lastName: 1, role: 1 } })
  .toArray()

users.forEach(u => console.log(`[${u.role}] ${u.email}  —  ${u.firstName} ${u.lastName}`))

await mongoose.disconnect()
