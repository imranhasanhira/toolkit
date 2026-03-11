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
import { ChevronDown, ChevronUp, Loader2, Sparkles, Check, X, Trash2 } from 'lucide-react';
import { PAGE_SIZE_OPTIONS, POST_STATUS_COLOR } from './projectDetailConstants';
import { PostRowExpansion } from './PostRowExpansion';

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
  updateStatus: (args: { projectPostId: string; status: 'DOWNLOADED' | 'MATCH' | 'RELEVANT' | 'DISCARDED' }) => Promise<unknown>;
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
    <div className={`flex items-center justify-between gap-4 py-3 ${borderClass} text-sm text-muted-foreground`}>
      <span className="tabular-nums flex items-center gap-1">
        <span>
          Showing {posts.length === 0 ? 0 : postsStartIndex + 1}–{postsEndIndex} of {postsTotal}
        </span>
        <span className="min-w-[6rem] tabular-nums">
          {selectedCount > 0 ? `· ${selectedCount} selected` : '\u00A0'}
        </span>
      </span>
      <div className="flex items-center gap-2">
        <Select value={String(postsPageSize)} onValueChange={(v) => setPostsPageSize(parseInt(v, 10))}>
          <SelectTrigger className="w-20">
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
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!postsNextCursor}
          onClick={() => {
            setPostsCursorHistory((h) => [...h, postsCursor ?? '']);
            setPostsCursor(postsNextCursor);
          }}
        >
          Next
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {postsTotal > 0 && tableToolbar('border-b')}
      <div className="overflow-x-auto">
        <table className="w-full text-sm table-fixed" style={{ tableLayout: 'fixed' }}>
          <thead>
            <tr className="border-b">
              <th className="p-2 w-8">
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
              <th className="text-left p-2 whitespace-nowrap">
                <button
                  type="button"
                  className="flex items-center gap-0.5 hover:text-foreground"
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
              <th className="text-left p-2">Title</th>
              <th className="text-left p-2">Author</th>
              <th className="text-left p-2">Subreddit</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Matched</th>
              <th className="text-left p-2">AI</th>
              <th className="text-left p-2 whitespace-nowrap">
                <button
                  type="button"
                  className="flex items-center gap-0.5 hover:text-foreground"
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
                  className={`border-b ${expandedPostId === pp.id ? 'bg-muted/30' : ''} cursor-pointer hover:bg-muted/50`}
                  onClick={() => setExpandedPostId((id) => (id === pp.id ? null : pp.id))}
                >
                  <td className="p-2" onClick={(e) => e.stopPropagation()}>
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
                  <td className="p-2 text-muted-foreground whitespace-nowrap text-xs tabular-nums">
                    {pp.post?.postedAt
                      ? new Date(pp.post.postedAt).toLocaleString(undefined, {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })
                      : '—'}
                  </td>
                  <td className="p-2 max-w-xs truncate" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1.5">
                      <a
                        href={pp.post?.postLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {pp.post?.title}
                      </a>
                      {pp.lastExportedAt && (
                        <span
                          className="inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
                          title="This post has been exported"
                        >
                          Exported
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-2" onClick={(e) => e.stopPropagation()}>
                    <a
                      href={pp.post?.author?.profileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {pp.post?.author?.redditUsername}
                    </a>
                  </td>
                  <td className="p-2" onClick={(e) => e.stopPropagation()}>
                    {pp.post?.subreddit ? (
                      <a
                        href={
                          pp.post.subreddit === 'all'
                            ? 'https://reddit.com'
                            : `https://reddit.com/r/${encodeURIComponent(pp.post.subreddit)}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        r/{pp.post.subreddit}
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="p-2" onClick={(e) => e.stopPropagation()}>
                    <Select
                      value={pp.status}
                      onValueChange={(v) =>
                        updateStatus({
                          projectPostId: pp.id,
                          status: v as 'DOWNLOADED' | 'MATCH' | 'RELEVANT' | 'DISCARDED',
                        }).then(() => refetchPosts())
                      }
                    >
                      <SelectTrigger className={`w-28 h-8 ${POST_STATUS_COLOR[pp.status] ?? ''}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DOWNLOADED">Downloaded</SelectItem>
                        <SelectItem value="MATCH">Match</SelectItem>
                        <SelectItem value="RELEVANT">Relevant</SelectItem>
                        <SelectItem value="DISCARDED">Discarded</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-2">
                    {Array.isArray(pp.matchedKeywords) && pp.matchedKeywords.length > 0
                      ? pp.matchedKeywords.join(', ')
                      : '—'}
                  </td>
                  <td className="p-2" onClick={(e) => e.stopPropagation()}>
                    <span className="inline-flex items-center gap-1.5">
                      {analyzingPostId === pp.id ? (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                      ) : pp.aiAnalysisStatus === 'PENDING' || pp.aiAnalysisStatus === 'IN_PROGRESS' ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : pp.aiAnalysisStatus === 'COMPLETED' ? (
                        pp.painPointSummary ? (
                          <span title="AI summary">
                            <Check className="h-4 w-4 shrink-0 text-green-600" />
                          </span>
                        ) : (
                          <span title="No pain point summary">
                            <X className="h-4 w-4 shrink-0 text-muted-foreground" />
                          </span>
                        )
                      ) : pp.aiAnalysisStatus === 'FAILED' ? (
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
                  <td className="p-2 text-muted-foreground whitespace-nowrap text-xs tabular-nums">
                    {pp.createdAt
                      ? new Date(pp.createdAt).toLocaleString(undefined, {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })
                      : '—'}
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
