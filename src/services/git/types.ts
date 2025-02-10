export interface CommitInfo {
  message: string;
  description?: string;
  date: string;
  author: string;
  sha: string;
}

export interface CommitParser {
  parseCommits(commits: unknown): CommitInfo[];
}

export type GitServiceKey = "gitlab";

export const GIT_SERVICE_INFO: {
  [key in GitServiceKey]: { domain: string; apiEndpoint: string };
} = {
  gitlab: {
    domain: "*",
    apiEndpoint: "commits.json",
  },
  //   github: {
  //     domain: "*",
  //     apiEndpoint: "*",
  //   },
} as const;
