// One-time script: delete all student users and their related data
import mongoose from 'mongoose'

const MONGO_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27018/pba_dev'

await mongoose.connect(MONGO_URI)
console.log('Connected to', MONGO_URI)

const db = mongoose.connection.db!

const users     = db.collection('users')
const students  = await users.find({ role: 'STUDENT' }, { projection: { _id: 1 } }).toArray()
const ids       = students.map(s => s._id)

console.log(`Found ${ids.length} student(s) to delete`)

if (ids.length === 0) {
  console.log('Nothing to delete.')
  await mongoose.disconnect()
  process.exit(0)
}

const results = await Promise.all([
  db.collection('cohortmemberships').deleteMany({ userId: { $in: ids } }),
  db.collection('studentsteps').deleteMany({ userId: { $in: ids } }),
  db.collection('stepsubmissions').deleteMany({ userId: { $in: ids } }),
  db.collection('refreshtokens').deleteMany({ userId: { $in: ids } }),
  db.collection('activitylogs').deleteMany({ userId: { $in: ids } }),
  db.collection('userbadges').deleteMany({ userId: { $in: ids } }),
  db.collection('certificates').deleteMany({ userId: { $in: ids } }),
])

const labels = [
  'cohortmemberships',
  'studentsteps',
  'stepsubmissions',
  'refreshtokens',
  'activitylogs',
  'userbadges',
  'certificates',
]

results.forEach((r, i) => console.log(`  ${labels[i]}: ${r.deletedCount} deleted`))

const { deletedCount } = await users.deleteMany({ role: 'STUDENT' })
console.log(`  users (students): ${deletedCount} deleted`)

console.log('\nDone ✓')
await mongoose.disconnect()
