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
  [key in GitServiceKey]: {
    domain: string;
    urlGuidanceMessage: string;
    apiEndpoint: string;
  };
} = {
  gitlab: {
    domain: "/merge_requests/\\d+/commits",
    urlGuidanceMessage: "Merge Request의 commit Tab으로 이동해주세요",
    apiEndpoint: "commits.json",
  },
  //   github: {
  //     domain: "*",
  //     apiEndpoint: "*",
  //   },
} as const;
