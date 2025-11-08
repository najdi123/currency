'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { FiSearch, FiUser, FiChevronLeft, FiChevronRight, FiRefreshCw } from 'react-icons/fi'
import { useListUsersQuery, type User } from '@/lib/store/services/walletApi'
import { formatDate } from '@/lib/utils/dateUtils'
import { Alert } from '@/components/ui/Alert'

// cn utility for conditional classes
const cn = (...classes: (string | boolean | undefined | null)[]) => {
  return classes.filter((c) => typeof c === 'string' && c.length > 0).join(' ')
}

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useState(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  })

  return debouncedValue
}

export function UserList() {
  const t = useTranslations('Admin')
  const locale = useLocale()
  const tCommon = useTranslations('Common')
  const router = useRouter()
  const [page, setPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearch = useDebounce(searchQuery, 300)

  const {
    data: usersData,
    isLoading,
    isError,
    error,
    refetch,
  } = useListUsersQuery({ page, pageSize: 20 })

  // Client-side search filtering
  const filteredUsers = useMemo(() => {
    if (!usersData?.users || !debouncedSearch) {
      return usersData?.users || []
    }

    const query = debouncedSearch.toLowerCase().trim()
    return usersData.users.filter(
      (user) =>
        user.email.toLowerCase().includes(query) ||
        user.firstName?.toLowerCase().includes(query) ||
        user.lastName?.toLowerCase().includes(query) ||
        user.id.toLowerCase().includes(query)
    )
  }, [usersData?.users, debouncedSearch])

  const handleUserClick = useCallback(
    (userId: string) => {
      router.push(`/admin/users/${userId}`)
    },
    [router]
  )

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
  }

  const getUserStatusBadge = (status: string) => {
    const statusConfig: Record<
      string,
      { label: string; className: string }
    > = {
      active: {
        label: t('statusActive'),
        className: 'bg-success-bg text-success-text',
      },
      inactive: {
        label: t('statusInactive'),
        className: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
      },
      suspended: {
        label: t('statusSuspended'),
        className: 'bg-warning-bg text-warning-text',
      },
      deleted: {
        label: t('statusDeleted'),
        className: 'bg-error-bg text-error-text',
      },
    }

    const config = statusConfig[status] || statusConfig.active
    return (
      <span
        className={cn(
          'px-2 py-0.5 rounded-full text-xs font-medium',
          config.className
        )}
      >
        {config.label}
      </span>
    )
  }

  const getRoleBadge = (role: string) => {
    const isAdmin = role === 'admin'
    return (
      <span
        className={cn(
          'px-2 py-0.5 rounded-full text-xs font-medium',
          isAdmin
            ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
            : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
        )}
      >
        {isAdmin ? t('admin') : t('regularUser')}
      </span>
    )
  }

  const getUserInitials = (user: User) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    }
    if (user.email) {
      return user.email.substring(0, 2).toUpperCase()
    }
    return 'U'
  }

  if (isError) {
    return (
      <Alert variant="error" title={t('errorLoadingUser')}>
        {(error as any)?.data?.message || t('errorOccurred')}
      </Alert>
    )
  }

  return (
    <div className="space-y-6" >
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{t('manageUsers')}</h1>
          <p className="text-sm text-text-tertiary mt-1">
            {t('viewManageAllUsers')}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isLoading}
          className="p-2 rounded-lg bg-bg-elevated hover:bg-bg-secondary border border-border-light text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label={t('refreshing')}
        >
          <FiRefreshCw className={cn('w-5 h-5', isLoading && 'animate-spin')} />
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <FiSearch className="absolute right-3 top-1/2 transform -translate-y-1/2 text-text-tertiary w-5 h-5" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="w-full pr-10 pl-4 py-3 bg-bg-elevated border border-border-light rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      {/* Loading State */}
      {isLoading && !usersData && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-bg-secondary rounded-lg p-4 h-20" />
            </div>
          ))}
        </div>
      )}

      {/* Users List */}
      {!isLoading && filteredUsers.length === 0 && (
        <div className="text-center py-12 bg-bg-elevated rounded-xl border border-border-light">
          <FiUser className="w-12 h-12 mx-auto text-text-tertiary mb-3" />
          <p className="text-text-secondary font-medium">
            {searchQuery ? t('noUsersFound') : t('noUsers')}
          </p>
          {searchQuery && (
            <p className="text-sm text-text-tertiary mt-1">
              {t('searchNoResults', { query: searchQuery })}
            </p>
          )}
        </div>
      )}

      {!isLoading && filteredUsers.length > 0 && (
        <div className="space-y-3">
          {filteredUsers.map((user) => {
            const dateInfo = formatDate(user.createdAt, t, locale)
            return (
              <button
                key={user.id}
                onClick={() => handleUserClick(user.id)}
                className="w-full bg-bg-elevated border border-border-light rounded-lg p-4 hover:shadow-md hover:border-accent/50 transition-all text-right"
              >
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-white font-semibold text-lg flex-shrink-0">
                    {getUserInitials(user)}
                  </div>

                  {/* User Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="text-base font-semibold text-text-primary truncate">
                        {user.firstName && user.lastName
                          ? `${user.firstName} ${user.lastName}`
                          : user.email}
                      </h3>
                      {getRoleBadge(user.role)}
                      {getUserStatusBadge(user.status)}
                    </div>
                    <p className="text-sm text-text-secondary truncate">{user.email}</p>
                    <p className="text-xs text-text-tertiary mt-1" title={dateInfo.absolute}>
                      {t('membership')} {dateInfo.relative}
                    </p>
                  </div>

                  {/* Arrow Icon */}
                  <FiChevronLeft className="w-5 h-5 text-text-tertiary flex-shrink-0" />
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {!isLoading && usersData && usersData.pagination.totalPages > 1 && !searchQuery && (
        <div className="flex items-center justify-between pt-4 border-t border-border-light">
          <div className="text-sm text-text-tertiary">
            {t('page')} {usersData.pagination.page} {t('of')} {usersData.pagination.totalPages} ({t('totalUsers')}{' '}
            {usersData.pagination.total} {usersData.pagination.total === 1 ? t('user') : t('users_plural')})
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1}
              className={cn(
                'p-2 rounded-lg transition-colors',
                page === 1
                  ? 'text-text-tertiary cursor-not-allowed'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary'
              )}
              aria-label={t('previousPage')}
            >
              <FiChevronRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page === usersData.pagination.totalPages}
              className={cn(
                'p-2 rounded-lg transition-colors',
                page === usersData.pagination.totalPages
                  ? 'text-text-tertiary cursor-not-allowed'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary'
              )}
              aria-label={t('nextPage')}
            >
              <FiChevronLeft className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Search Results Count */}
      {searchQuery && filteredUsers.length > 0 && (
        <div className="text-sm text-text-tertiary text-center">
          {filteredUsers.length} {t('usersFound')}
        </div>
      )}
    </div>
  )
}
