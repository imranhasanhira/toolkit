/** Rendered only when a post row is expanded; avoids building expansion DOM for collapsed rows. */
export function PostRowExpansion({ post }: { post: any }) {
  return (
    <tr className="border-b bg-muted/20">
      <td colSpan={9} className="p-4 align-top">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm max-w-full">
          <div className="min-w-0">
            <h4 className="font-medium mb-1">Post</h4>
            <p className="text-muted-foreground text-xs mb-1">
              {post.post?.title && <span className="font-medium text-foreground">{post.post.title}</span>}
              {post.post?.postLink && (
                <a href={post.post.postLink} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline ml-1">Link</a>
              )}
              {post.post?.author?.redditUsername && (
                <span className="ml-1">by u/{post.post.author.redditUsername}</span>
              )}
            </p>
            <p className="text-muted-foreground whitespace-pre-wrap max-h-48 overflow-y-auto">
              {post.post?.content || '—'}
            </p>
          </div>
          <div className="min-w-0 space-y-3">
            <div>
              <h4 className="font-medium mb-1">Pain point / Intent</h4>
              <p className="text-muted-foreground whitespace-pre-wrap">
                {post.painPointSummary || '—'}
              </p>
            </div>
            {post.aiReasoning && (
              <div>
                <h4 className="font-medium mb-1">AI Reasoning</h4>
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {post.aiReasoning}
                </p>
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}
