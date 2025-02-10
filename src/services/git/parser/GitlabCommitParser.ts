import { CommitInfo } from "../types";

export class GitlabCommitParser {
  private static readonly PATTERNS = {
    commit:
      /<li class="commit flex-row[^>]*>[\s\S]*?<\/li>|<li class="commit flex-row js-toggle-container"[\s\S]*?<\/li>/g,
    message:
      /<a class="commit-row-message item-title[^>]*>([^<]+)<\/a>|<a class="commit-row-message item-title js-onboarding-commit-item[^>]*>([^<]+)<\/a>/,
    description:
      /<pre class="commit-row-description[^>]*>([^<]+)<\/pre>|<pre class="commit-row-description gl-whitespace-pre-wrap[^>]*>([^<]+)<\/pre>/,
    date: /<time[^>]*datetime="([^"]+)"/,
    author: /<a class="commit-author-link[^>]*>([^<]+)<\/a>/,
    sha: /<div class="label label-monospace[^>]*>([^<]+)<\/div>|<span class="gl-button-text gl-font-monospace">\s*([^<\s]+)\s*<\/span>/,
  };

  public static parseCommits(commits: { html: string }): CommitInfo[] {
    const results: CommitInfo[] = [];
    let match;

    while (
      (match = GitlabCommitParser.PATTERNS.commit.exec(commits.html)) !== null
    ) {
      const commitHtml = match[0];
      const parsedCommit = this.parseCommitHtml(commitHtml);

      if (this.isValidCommit(parsedCommit)) {
        results.push(parsedCommit as CommitInfo);
      }
    }

    return results;
  }

  private static parseCommitHtml(commitHtml: string): Partial<CommitInfo> {
    const messageMatch = GitlabCommitParser.PATTERNS.message.exec(commitHtml);
    const message = (messageMatch?.[1] || messageMatch?.[2])?.trim();

    const descriptionMatch =
      GitlabCommitParser.PATTERNS.description.exec(commitHtml);
    const description = descriptionMatch?.[1] || descriptionMatch?.[2];

    const date = GitlabCommitParser.PATTERNS.date.exec(commitHtml)?.[1];
    const author = GitlabCommitParser.PATTERNS.author
      .exec(commitHtml)?.[1]
      ?.trim();

    const shaMatch = GitlabCommitParser.PATTERNS.sha.exec(commitHtml);
    const sha = (shaMatch?.[1] || shaMatch?.[2])?.trim();

    return {
      message,
      description: description
        ? GitlabCommitParser.decodeHtmlEntities(description.trim())
        : undefined,
      date,
      author,
      sha,
    };
  }

  private static isValidCommit(commit: Partial<CommitInfo>): boolean {
    return !!(commit.message && commit.date && commit.author && commit.sha);
  }

  private static decodeHtmlEntities(text: string): string {
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
