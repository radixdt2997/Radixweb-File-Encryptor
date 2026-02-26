/**
 * My Transactions / All Transactions (Phase 6). Requires login.
 */

import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { useAuthStore } from '../stores/authStore';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Input } from './ui/Input';
import { ExpiryType, FileStatus, TransactionRole, UserRole } from '../types';
import { formatDate } from '../utils/file';

function formatStatus(status: FileStatus | string): string {
    if (status === FileStatus.Active) return 'Active';
    if (status === FileStatus.Expired) return 'Expired';
    if (status === FileStatus.Used) return 'Used';
    return String(status);
}

function formatExpiryType(expiryType: ExpiryType | string): string {
    if (expiryType === ExpiryType.OneTime) return 'One-time';
    if (expiryType === ExpiryType.TimeBased) return 'Time-based';
    return String(expiryType);
}

export function Transactions() {
    const { token, user } = useAuthStore();
    const [page, setPage] = useState(1);
    const [typeFilter, setTypeFilter] = useState<'sent' | 'received' | undefined>(undefined);
    const [scopeAll, setScopeAll] = useState(false);
    const [filterFileName, setFilterFileName] = useState('');
    const [filterEmail, setFilterEmail] = useState('');
    const [appliedFileName, setAppliedFileName] = useState('');
    const [appliedEmail, setAppliedEmail] = useState('');

    const isAdmin = user?.role === UserRole.Admin;
    const limit = 20;

    const applyFilters = useCallback(() => {
        setAppliedFileName(filterFileName.trim());
        setAppliedEmail(filterEmail.trim());
        setPage(1);
    }, [filterFileName, filterEmail]);

    const clearFilters = useCallback(() => {
        setFilterFileName('');
        setFilterEmail('');
        setAppliedFileName('');
        setAppliedEmail('');
        setPage(1);
    }, []);

    const hasActiveFilters = appliedFileName !== '' || appliedEmail !== '';

    const { data, isLoading, isError, error, refetch } = useQuery({
        queryKey: [
            'transactions',
            page,
            typeFilter,
            scopeAll,
            appliedFileName,
            appliedEmail,
            token,
        ],
        queryFn: () =>
            api.getTransactions(token, {
                page,
                limit,
                type: typeFilter,
                scope: isAdmin && scopeAll ? 'all' : undefined,
                fileName: appliedFileName || undefined,
                email: appliedEmail || undefined,
            }),
        enabled: !!token,
    });

    const handlePrev = useCallback(() => {
        setPage((p) => Math.max(1, p - 1));
    }, []);
    const handleNext = useCallback(() => {
        if (data && page * limit < data.total) setPage((p) => p + 1);
    }, [data, page]);

    if (!token) {
        return (
            <Card title="My Transactions">
                <p className="text-gray-400 text-sm">Log in to view your transactions.</p>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <Card title="My Transactions" subtitle="Files you sent or received">
                {isAdmin && (
                    <div className="flex items-center gap-3 mb-4">
                        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={scopeAll}
                                onChange={(e) => {
                                    setScopeAll(e.target.checked);
                                    setPage(1);
                                }}
                                className="h-4 w-4 rounded border-gray-500 bg-gray-700 text-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 focus:ring-offset-gray-900 cursor-pointer"
                            />
                            Show all transactions (admin)
                        </label>
                    </div>
                )}
                <div className="flex gap-2 mb-4">
                    <Button
                        variant={typeFilter === undefined ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={() => {
                            setTypeFilter(undefined);
                            setPage(1);
                        }}
                        fullWidth
                    >
                        All
                    </Button>
                    <Button
                        variant={typeFilter === 'sent' ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={() => {
                            setTypeFilter('sent');
                            setPage(1);
                        }}
                        fullWidth
                    >
                        Sent
                    </Button>
                    <Button
                        variant={typeFilter === 'received' ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={() => {
                            setTypeFilter('received');
                            setPage(1);
                        }}
                        fullWidth
                    >
                        Received
                    </Button>
                </div>

                <div className="flex flex-wrap items-end gap-3 mb-4 p-3 bg-gray-800/30 rounded-lg border border-gray-700">
                    <div className="min-w-[140px] flex-1">
                        <Input
                            label="File name"
                            type="text"
                            value={filterFileName}
                            onChange={(e) => setFilterFileName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                            placeholder="Filter by file name…"
                        />
                    </div>
                    <div className="min-w-[140px] flex-1">
                        <Input
                            label="Email"
                            type="text"
                            value={filterEmail}
                            onChange={(e) => setFilterEmail(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                            placeholder="Filter by sender or recipient"
                        />
                    </div>
                    <div className="flex gap-2">
                        <Button variant="secondary" size="sm" onClick={applyFilters}>
                            Apply
                        </Button>
                        {hasActiveFilters && (
                            <Button variant="ghost" size="sm" onClick={clearFilters}>
                                Clear filters
                            </Button>
                        )}
                    </div>
                </div>

                {isLoading && <p className="text-gray-400 text-sm">Loading…</p>}
                {isError && (
                    <p className="text-red-400 text-sm">
                        {(error as Error).message}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => refetch()}
                            className="ml-2"
                        >
                            Retry
                        </Button>
                    </p>
                )}
                {data && !isLoading && (
                    <>
                        <div className="space-y-2">
                            {data.items.length === 0 ? (
                                <p className="text-gray-400 text-sm">No transactions yet.</p>
                            ) : (
                                data.items.map((item) => (
                                    <div
                                        key={item.fileId}
                                        className="flex flex-wrap items-start justify-between gap-3 p-3 bg-gray-800/50 rounded-lg border border-gray-600"
                                    >
                                        <div className="min-w-0 flex-1 space-y-1.5">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="font-medium text-white truncate">
                                                    {item.fileName}
                                                </p>
                                                <span
                                                    className={
                                                        item.role === TransactionRole.Sender
                                                            ? 'text-cyan-400'
                                                            : 'text-green-400'
                                                    }
                                                >
                                                    {item.role === TransactionRole.Sender
                                                        ? 'Sent'
                                                        : 'Received'}
                                                </span>
                                                <span
                                                    className={
                                                        item.status === FileStatus.Active
                                                            ? 'text-green-400'
                                                            : 'text-amber-400'
                                                    }
                                                >
                                                    {formatStatus(item.status)}
                                                </span>
                                                {item.recipientCount > 0 && (
                                                    <span className="text-gray-400 text-xs">
                                                        {item.recipientCount} recipient
                                                        {item.recipientCount !== 1 ? 's' : ''}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-0.5 text-xs text-gray-400">
                                                <span>
                                                    <span className="text-gray-500">
                                                        Sent from:
                                                    </span>{' '}
                                                    {item.uploadedByEmail ?? '—'}
                                                </span>
                                                <span>
                                                    <span className="text-gray-500">Sent to:</span>{' '}
                                                    {item.recipientEmails?.length
                                                        ? item.recipientEmails.join(', ')
                                                        : '—'}
                                                </span>
                                                <span>
                                                    <span className="text-gray-500">
                                                        {item.status === FileStatus.Expired
                                                            ? 'Expired at'
                                                            : 'Expires at'}
                                                        :
                                                    </span>{' '}
                                                    {formatDate(item.expiryTime)}
                                                </span>
                                                <span>
                                                    <span className="text-gray-500">Method:</span>{' '}
                                                    {formatExpiryType(item.expiryType)}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-500">
                                                Uploaded {formatDate(item.uploadedAt)}
                                            </p>
                                        </div>
                                        {item.status === FileStatus.Expired ? (
                                            <span className="text-sm text-gray-500 shrink-0">
                                                Expired
                                            </span>
                                        ) : (
                                            <Link
                                                to={
                                                    item.role === TransactionRole.Sender
                                                        ? `/send-file?fileId=${item.fileId}`
                                                        : `/receive-file?fileId=${item.fileId}`
                                                }
                                                className="text-sm text-blue-400 hover:underline shrink-0"
                                            >
                                                Open
                                            </Link>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                        {data.total > limit && (
                            <div className="flex items-center justify-between pt-4 border-t border-gray-600">
                                <p className="text-xs text-gray-400">
                                    Page {page} of {Math.ceil(data.total / limit)} ({data.total}{' '}
                                    total)
                                </p>
                                <div className="flex gap-2">
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={handlePrev}
                                        disabled={page <= 1}
                                    >
                                        Previous
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={handleNext}
                                        disabled={page * limit >= data.total}
                                    >
                                        Next
                                    </Button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </Card>
        </div>
    );
}
