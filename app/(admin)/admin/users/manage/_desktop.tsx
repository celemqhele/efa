'use client'
import UsersAndManagersClient from './UsersAndManagersClient'

export default function Desktop({ data }: { data: any }) {
  return <UsersAndManagersClient data={data} variant="desktop" />
}
