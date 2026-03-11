import React, { Fragment } from 'react';
import { Button } from '../../client/components/ui/button';
import { Checkbox } from '../../client/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../client/components/ui/select';
import { CheckCircle, ChevronDown, ChevronUp, Download, Loader2, Sparkles, Check, X, Trash2 } from 'lucide-react';
import { PAGE_SIZE_OPTIONS, POST_STATUS_COLOR } from './projectDetailConstants';
import { PostRowExpansion } from './PostRowExpansion';
import { RedditBotProjectPostStatus, RedditBotAiAnalysisStatus } from '@prisma/client';

type Props = {
  posts: any[];
  selectedPostIds: string[];
  setSelectedPostIds: React.Dispatch<React.SetStateAction<string[]>>;
  expandedPostId: string | null;
  setExpandedPostId: React.Dispatch<React.SetStateAction<string | null>>;
  postsSortBy: 'postedAt' | 'createdAt';
  setPostsSortBy: (v: 'postedAt' | 'createdAt') => void;
  postsOrder: 'asc' | 'desc';
  setPostsOrder: React.Dispatch<React.SetStateAction<'asc' | 'desc'>>;
  updateStatus: (args: { projectPostId: string; status: RedditBotProjectPostStatus }) => Promise<unknown>;
  refetchPosts: () => void;
  analyzingPostId: string | null;
  setAnalyzingPostId: (v: string | null) => void;
  analyzePost: (args: { projectPostId: string }) => Promise<unknown>;
  aiConfig: any;
  postsTotal: number;
  postsStartIndex: number;
  postsEndIndex: number;
  postsCursorHistory: string[];
  postsNextCursor: string | null;
  postsCursor: string | null;
  setPostsCursorHistory: React.Dispatch<React.SetStateAction<string[]>>;
  setPostsCursor: React.Dispatch<React.SetStateAction<string | null>>;
  onDeleteSelected: () => Promise<void>;
  projectId: string | undefined;
  postsPageSize: number;
  setPostsPageSize: (size: number) => void;
};

export function PostsTable({
  posts,
  selectedPostIds,
  setSelectedPostIds,
  expandedPostId,
  setExpandedPostId,
  postsSortBy,
  setPostsSortBy,
  postsOrder,
  setPostsOrder,
  updateStatus,
  refetchPosts,
  analyzingPostId,
  setAnalyzingPostId,
  analyzePost,
  aiConfig,
  postsTotal,
  postsStartIndex,
  postsEndIndex,
  postsCursorHistory,
  postsNextCursor,
  postsCursor,
  setPostsCursorHistory,
  setPostsCursor,
  onDeleteSelected,
  projectId,
  postsPageSize,
  setPostsPageSize,
}: Props) {
  const selectedCount = selectedPostIds.length;
  const tableToolbar = (borderClass: 'border-b' | 'border-t') => (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 py-3 ${borderClass} text-sm text-muted-foreground min-w-0`}
    >
      <span className="tabular-nums flex items-center gap-1 min-w-0 flex-1 basis-full sm:basis-auto sm:flex-initial">
        <span className="min-w-0">
          Showing {posts.length === 0 ? 0 : postsStartIndex + 1}–{postsEndIndex} of {postsTotal}
        </span>
        <span className="min-w-[6rem] tabular-nums shrink-0">
          {selectedCount > 0 ? `· ${selectedCount} selected` : '\u00A0'}
        </span>
      </span>
      <div className="flex items-center gap-2 shrink-0 flex-wrap">
        <Select value={String(postsPageSize)} onValueChange={(v) => setPostsPageSize(parseInt(v, 10))}>
          <SelectTrigger className="w-20 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          disabled={selectedCount === 0 || !projectId}
          onClick={onDeleteSelected}
          title="Delete selected"
          className="min-w-[4.5rem]"
        >
          <Trash2 className="h-4 w-4 shrink-0" />
          <span className="w-5 h-5 flex items-center justify-center rounded-full bg-muted text-xs tabular-nums font-medium shrink-0">
            {selectedCount > 0 ? selectedCount : ''}
          </span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={postsCursorHistory.length === 0}
          onClick={() => {
            const prev = postsCursorHistory[postsCursorHistory.length - 1];
            setPostsCursorHistory((h) => h.slice(0, -1));
            setPostsCursor(prev === '' || prev == null ? null : prev);
          }}
        title="Previous page"
        >
          <span className="hidden sm:inline">Previous</span>
          <span className="sm:hidden">Prev</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!postsNextCursor}
          onClick={() => {
            setPostsCursorHistory((h) => [...h, postsCursor ?? '']);
            setPostsCursor(postsNextCursor);
          }}
          title="Next page"
        >
          Next
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {postsTotal > 0 && tableToolbar('border-b')}
      <div className="overflow-x-auto min-w-0 w-full">
        <table className="w-full text-sm min-w-[48rem] md:min-w-0 border-collapse">
          <thead>
            <tr className="border-b [&>th:last-child]:border-r-0">
              <th className="p-2 w-8 border-r border-border overflow-hidden min-w-0">
                <Checkbox
                  aria-label="Select all posts on this page"
                  checked={
                    posts.length === 0
                      ? false
                      : posts.every((pp: any) => selectedPostIds.includes(pp.id))
                        ? true
                        : posts.some((pp: any) => selectedPostIds.includes(pp.id))
                          ? 'indeterminate'
                          : false
                  }
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedPostIds(Array.from(new Set([...selectedPostIds, ...posts.map((pp: any) => pp.id)])));
                    } else {
                      const currentIds = new Set(posts.map((pp: any) => pp.id));
                      setSelectedPostIds((ids) => ids.filter((id) => !currentIds.has(id)));
                    }
                  }}
                />
              </th>
              <th className="text-left p-2 whitespace-nowrap border-r border-border overflow-hidden min-w-0">
                <button
                  type="button"
                  className="flex items-center gap-0.5 hover:text-foreground min-w-0 truncate"
                  onClick={() => {
                    if (postsSortBy === 'postedAt') setPostsOrder((o) => (o === 'desc' ? 'asc' : 'desc'));
                    else {
                      setPostsSortBy('postedAt');
                      setPostsOrder('desc');
                    }
                  }}
                >
                  Posted
                  {postsSortBy === 'postedAt' &&
                    (postsOrder === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                </button>
              </th>
              <th className="text-left p-2 border-r border-border overflow-hidden min-w-0">Title</th>
              <th className="text-left p-2 border-r border-border">Author</th>
              <th className="text-left p-2 border-r border-border">Subreddit</th>
              <th className="text-left p-2 border-r border-border">Status</th>
              <th className="text-left p-2 border-r border-border">Matched</th>
              <th className="text-left p-2 w-9 border-r border-border overflow-hidden min-w-0" title="Exported">
                <span className="sr-only">Exported</span>
                <Download className="h-4 w-4 inline-block text-muted-foreground" aria-hidden />
              </th>
              <th className="text-left p-2 border-r border-border overflow-hidden min-w-0">AI</th>
              <th className="hidden sm:table-cell text-left p-2 whitespace-nowrap border-r border-border overflow-hidden min-w-0">
                <button
                  type="button"
                  className="flex items-center gap-0.5 hover:text-foreground min-w-0 truncate"
                  onClick={() => {
                    if (postsSortBy === 'createdAt') setPostsOrder((o) => (o === 'desc' ? 'asc' : 'desc'));
                    else {
                      setPostsSortBy('createdAt');
                      setPostsOrder('desc');
                    }
                  }}
                >
                  Fetched
                  {postsSortBy === 'createdAt' &&
                    (postsOrder === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {posts.map((pp: any) => (
              <Fragment key={pp.id}>
                <tr
                  className={`border-b [&>td:last-child]:border-r-0 ${expandedPostId === pp.id ? 'bg-muted/30' : ''} cursor-pointer hover:bg-muted/50`}
                  onClick={() => setExpandedPostId((id) => (id === pp.id ? null : pp.id))}
                >
                  <td className="p-2 border-r border-border" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      aria-label="Select post"
                      checked={selectedPostIds.includes(pp.id)}
                      onCheckedChange={(checked) => {
                        setSelectedPostIds((ids) =>
                          checked ? [...ids, pp.id] : ids.filter((id) => id !== pp.id)
                        );
                      }}
                    />
                  </td>
                  <td className="p-2 text-muted-foreground text-xs tabular-nums border-r border-border overflow-hidden min-w-0">
                    <span className="block min-w-0 truncate" title={pp.post?.postedAt ? new Date(pp.post.postedAt).toLocaleString() : undefined}>
                      {pp.post?.postedAt
                        ? new Date(pp.post.postedAt).toLocaleString(undefined, {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })
                        : '—'}
                    </span>
                  </td>
                  <td className="p-2 border-r border-border overflow-hidden min-w-0" onClick={(e) => e.stopPropagation()}>
                    <a
                      href={pp.post?.postLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline block min-w-0 truncate md:whitespace-normal md:overflow-visible"
                      title={pp.post?.title}
                    >
                      {pp.post?.title}
                    </a>
                  </td>
                  <td className="p-2 border-r border-border" onClick={(e) => e.stopPropagation()}>
                    <a
                      href={pp.post?.author?.profileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline block min-w-0 truncate"
                      title={pp.post?.author?.redditUsername}
                    >
                      {pp.post?.author?.redditUsername}
                    </a>
                  </td>
                  <td className="p-2 border-r border-border" onClick={(e) => e.stopPropagation()}>
                    {pp.post?.subreddit ? (
                      <a
                        href={
                          pp.post.subreddit === 'all'
                            ? 'https://reddit.com'
                            : `https://reddit.com/r/${encodeURIComponent(pp.post.subreddit)}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline block min-w-0 truncate"
                        title={`r/${pp.post.subreddit}`}
                      >
                        r/{pp.post.subreddit}
                      </a>
                    ) : (
                      <span className="block min-w-0 truncate">—</span>
                    )}
                  </td>
                  <td className="p-2 border-r border-border overflow-hidden min-w-0" onClick={(e) => e.stopPropagation()}>
                    <Select
                      value={pp.status}
                      onValueChange={(v) =>
                        updateStatus({
                          projectPostId: pp.id,
                          status: v as RedditBotProjectPostStatus,
                        }).then(() => refetchPosts())
                      }
                    >
                      <SelectTrigger className={`w-28 max-w-full h-8 min-w-0 ${POST_STATUS_COLOR[pp.status] ?? ''}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={RedditBotProjectPostStatus.DOWNLOADED}>Downloaded</SelectItem>
                        <SelectItem value={RedditBotProjectPostStatus.MATCH}>Match</SelectItem>
                        <SelectItem value={RedditBotProjectPostStatus.RELEVANT}>Relevant</SelectItem>
                        <SelectItem value={RedditBotProjectPostStatus.DISCARDED}>Discarded</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-2 border-r border-border overflow-hidden min-w-0">
                    <span className="block min-w-0 truncate" title={Array.isArray(pp.matchedKeywords) && pp.matchedKeywords.length > 0 ? pp.matchedKeywords.join(', ') : undefined}>
                      {Array.isArray(pp.matchedKeywords) && pp.matchedKeywords.length > 0
                        ? pp.matchedKeywords.join(', ')
                        : '—'}
                    </span>
                  </td>
                  <td className="p-2 w-9 text-center border-r border-border overflow-hidden min-w-0" title={pp.lastExportedAt ? 'Exported' : undefined}>
                    {pp.lastExportedAt ? (
                      <CheckCircle className="h-4 w-4 inline-block text-green-600" aria-hidden />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-2 border-r border-border overflow-hidden min-w-0" onClick={(e) => e.stopPropagation()}>
                    <span className="inline-flex items-center gap-1.5 min-w-0">
                      {analyzingPostId === pp.id ? (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                      ) : pp.aiAnalysisStatus === RedditBotAiAnalysisStatus.PENDING || pp.aiAnalysisStatus === RedditBotAiAnalysisStatus.IN_PROGRESS ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : pp.aiAnalysisStatus === RedditBotAiAnalysisStatus.COMPLETED ? (
                        pp.painPointSummary ? (
                          <span title="AI summary">
                            <Check className="h-4 w-4 shrink-0 text-green-600" />
                          </span>
                        ) : (
                          <span title="No pain point summary">
                            <X className="h-4 w-4 shrink-0 text-muted-foreground" />
                          </span>
                        )
                      ) : pp.aiAnalysisStatus === RedditBotAiAnalysisStatus.FAILED ? (
                        <span title={pp.aiAnalysisErrorMessage ?? 'Analysis failed'}>
                          <X className="h-4 w-4 shrink-0 text-destructive" />
                        </span>
                      ) : null}
                      {analyzingPostId !== pp.id && aiConfig?.configured !== false && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          title="Run AI analysis on this post"
                          onClick={() => {
                            setAnalyzingPostId(pp.id);
                            analyzePost({ projectPostId: pp.id })
                              .then(() => refetchPosts())
                              .catch(() => refetchPosts())
                              .finally(() => setAnalyzingPostId(null));
                          }}
                        >
                          <Sparkles className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                        </Button>
                      )}
                    </span>
                  </td>
                  <td className="hidden sm:table-cell p-2 text-muted-foreground text-xs tabular-nums border-r border-border overflow-hidden min-w-0">
                    <span className="block min-w-0 truncate" title={pp.createdAt ? new Date(pp.createdAt).toLocaleString() : undefined}>
                      {pp.createdAt
                        ? new Date(pp.createdAt).toLocaleString(undefined, {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })
                        : '—'}
                    </span>
                  </td>
                </tr>
                {expandedPostId === pp.id && <PostRowExpansion post={pp} />}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {postsTotal > 0 && tableToolbar('border-t')}
      {posts.length === 0 && (
        <p className="text-muted-foreground py-4 text-center">No posts yet. Run an exploration.</p>
      )}
    </>
  );
}
