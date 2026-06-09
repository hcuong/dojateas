import { auth } from '../src/lib/auth.server'

await auth.api.signUpEmail({
  body: {
    email: 'admin@dojateas.vn',
    password: 'changeme123',
    name: 'Admin',
  },
})
console.log('Admin user created: admin@dojateas.vn / changeme123')
process.exit(0)
