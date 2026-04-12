import { db, UsersTable } from '@/lib/drizzle'
import { timeAgo } from '@/lib/utils'
import Image from 'next/image'
import RefreshButton from './refresh-button'
import { seed } from '@/lib/seed'

export default async function Table() {
  let users
  let startTime = Date.now()
  try {
    users = await db.select().from(UsersTable)
  } catch (e: any) {
    if (e.message === `relation "profiles" does not exist`) {
      console.log(
        'Table does not exist, creating and seeding it with dummy data now...'
      )
      // Table is not created yet
      await seed()
      startTime = Date.now()
      users = await db.select().from(UsersTable)
    } else {
      throw e
    }
  }

  const duration = Date.now() - startTime

  return (
    <main>
      <h1>
        Welcome to battleship!
      </h1>



    </main>
  )
}
