import { GitlabCommitParser } from "./parser/GitlabCommitParser";
import { CommitParser, GIT_SERVICE_INFO } from "./types";

const parsers = {
  gitlab: GitlabCommitParser,
} as const;

export const getGitInfo = (): {
  domain: string;
  apiEndpoint: string;
  parser: CommitParser;
} => {
  const gitServiceKey = getGitServiceKey();
  const serviceInfo = GIT_SERVICE_INFO[gitServiceKey];

  return {
    ...serviceInfo,
    parser: parsers[gitServiceKey],
  };
};

// TODO 추후 조건에 따라 확장
export const getGitServiceKey = () => {
  return "gitlab";
};
