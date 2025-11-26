'use client'

import { HomePageContent } from '@/components/home/HomePageContent'

/**
 * Home page component.
 *
 * This is the main entry point for the home page.
 * All the actual content and logic is delegated to HomePageContent
 * for better separation of concerns and maintainability.
 *
 * The page remains a client component since it orchestrates
 * client-side state management and interactivity.
 */
export default function Home() {
  return <HomePageContent />
}
