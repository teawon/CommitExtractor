export interface CommitInfo {
  message: string;
  description?: string;
  date: string;
  author: string;
  ㄴ;
  sha: string;
}

export class GitlabCommitParser {
  private static readonly PATTERNS = {
    commit: /<li class="commit flex-row[^>]*>[\s\S]*?<\/li>/g,
    message: /<a class="commit-row-message item-title[^>]*>([^<]+)<\/a>/,
    description: /<pre class="commit-row-description[^>]*>([^<]+)<\/pre>/,
    date: /<time[^>]*datetime="([^"]+)"/,
    author: /<a class="commit-author-link[^>]*>([^<]+)<\/a>/,
    sha: /<div class="label label-monospace[^>]*>([^<]+)<\/div>/,
  };

  public parseCommits(jsonResponse: { html: string }): CommitInfo[] {
    const commits: CommitInfo[] = [];
    let match;

    while (
      (match = GitlabCommitParser.PATTERNS.commit.exec(jsonResponse.html)) !==
      null
    ) {
      const commitHtml = match[0];
      const parsedCommit = this.parseCommitHtml(commitHtml);

      if (this.isValidCommit(parsedCommit)) {
        commits.push(parsedCommit as CommitInfo);
      }
    }

    return commits;
  }

  private parseCommitHtml(commitHtml: string): Partial<CommitInfo> {
    const message = GitlabCommitParser.PATTERNS.message
      .exec(commitHtml)?.[1]
      ?.trim();
    const description =
      GitlabCommitParser.PATTERNS.description.exec(commitHtml)?.[1];
    const date = GitlabCommitParser.PATTERNS.date.exec(commitHtml)?.[1];
    const author = GitlabCommitParser.PATTERNS.author
      .exec(commitHtml)?.[1]
      ?.trim();
    const sha = GitlabCommitParser.PATTERNS.sha.exec(commitHtml)?.[1]?.trim();

    return {
      message,
      description: description
        ? this.decodeHtmlEntities(description.trim())
        : undefined,
      date,
      author,
      sha,
    };
  }

  private isValidCommit(commit: Partial<CommitInfo>): boolean {
    return !!(commit.message && commit.date && commit.author && commit.sha);
  }

  private decodeHtmlEntities(text: string): string {
    const entities: Record<string, string> = {
      "&#x000A;": "\n",
      "&quot;": '"',
      "&amp;": "&",
      "&lt;": "<",
      "&gt;": ">",
      "&#39;": "'",
      "&nbsp;": " ",
    };

    return text.replace(/&[#\w]+;/g, (entity) => entities[entity] || entity);
  }
}
