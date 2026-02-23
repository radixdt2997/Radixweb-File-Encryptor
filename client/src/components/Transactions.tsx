/**
 * My Transactions / All Transactions (Phase 6). Requires login.
 */

import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { useAuthStore } from "../stores/authStore";
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import { FileStatus, TransactionRole } from "../types";
import { formatDate } from "../utils/file";

function formatStatus(status: FileStatus | string): string {
  if (status === FileStatus.Active) return "Active";
  if (status === FileStatus.Expired) return "Expired";
  if (status === FileStatus.Used) return "Used";
  return String(status);
}

export function Transactions() {
  const { token, user } = useAuthStore();
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<"sent" | "received" | undefined>(
    undefined,
  );
  const [scopeAll, setScopeAll] = useState(false);

  const isAdmin = user?.role === "admin";
  const limit = 20;

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["transactions", page, typeFilter, scopeAll, token],
    queryFn: () =>
      api.getTransactions(token, {
        page,
        limit,
        type: typeFilter,
        scope: isAdmin && scopeAll ? "all" : undefined,
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
        <p className="text-gray-400 text-sm">
          Log in to view your transactions.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card title="My Transactions" subtitle="Files you sent or received">
        {isAdmin && (
          <div className="flex items-center gap-3 mb-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={scopeAll}
                onChange={(e) => {
                  setScopeAll(e.target.checked);
                  setPage(1);
                }}
                className="rounded border-gray-500"
              />
              Show all transactions (admin)
            </label>
          </div>
        )}
        <div className="flex gap-2 mb-4">
          <Button
            variant={typeFilter === undefined ? "primary" : "secondary"}
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
            variant={typeFilter === "sent" ? "primary" : "secondary"}
            size="sm"
            onClick={() => {
              setTypeFilter("sent");
              setPage(1);
            }}
            fullWidth
          >
            Sent
          </Button>
          <Button
            variant={typeFilter === "received" ? "primary" : "secondary"}
            size="sm"
            onClick={() => {
              setTypeFilter("received");
              setPage(1);
            }}
            fullWidth
          >
            Received
          </Button>
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
                    className="flex flex-wrap items-center justify-between gap-2 p-3 bg-gray-800/50 rounded-lg border border-gray-600"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-white truncate">
                        {item.fileName}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatDate(item.uploadedAt)}
                        {" · "}
                        <span
                          className={
                            item.role === TransactionRole.Sender
                              ? "text-cyan-400"
                              : "text-green-400"
                          }
                        >
                          {item.role === TransactionRole.Sender
                            ? "Sent"
                            : "Received"}
                        </span>
                        {" · "}
                        {item.recipientCount} recipient
                        {item.recipientCount !== 1 ? "s" : ""}
                        {" · "}
                        <span
                          className={
                            item.status === FileStatus.Active
                              ? "text-green-400"
                              : "text-amber-400"
                          }
                        >
                          {formatStatus(item.status)}
                        </span>
                      </p>
                    </div>
                    {item.status === FileStatus.Expired ? (
                      <span className="text-sm text-gray-500">Expired</span>
                    ) : (
                      <Link
                        to={
                          item.role === TransactionRole.Sender
                            ? `/send-file?fileId=${item.fileId}`
                            : `/receive-file?fileId=${item.fileId}`
                        }
                        className="text-sm text-blue-400 hover:underline"
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
                  Page {page} of {Math.ceil(data.total / limit)} ({data.total}{" "}
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
