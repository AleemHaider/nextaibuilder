import mongoose from 'mongoose'

const MONGO_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27018/pba_dev'
const EMAIL = 'devspots1@gmail.com'

await mongoose.connect(MONGO_URI)
const db = mongoose.connection.db!

const user = await db.collection('users').findOne({ email: EMAIL })
if (!user) {
  console.log('User not found:', EMAIL)
  await mongoose.disconnect()
  process.exit(0)
}

await db.collection('refreshtokens').deleteMany({ userId: user._id })
await db.collection('activitylogs').deleteMany({ actorId: user._id })
await db.collection('users').deleteOne({ _id: user._id })

console.log(`Deleted ${EMAIL} (${user.role} — ${user.firstName} ${user.lastName})`)
await mongoose.disconnect()
