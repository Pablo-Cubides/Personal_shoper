import { NextResponse } from 'next/server'
import { moderateImage } from '../../../lib/moderation'

export async function POST(req: Request) {
  const { imageUrl } = await req.json()
  const res = await moderateImage(imageUrl)
  return NextResponse.json(res)
}
