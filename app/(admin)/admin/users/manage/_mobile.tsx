'use client'
import UsersAndManagersClient from './UsersAndManagersClient'

export default function Mobile({ data }: { data: any }) {
  return <UsersAndManagersClient data={data} variant="mobile" />
}
