import { CommitInfo } from "../types";

interface ParsedCommit {
  key: string;
  message: string;
}

interface TicketSummary {
  [key: string]: string[];
}

export class CommitMessageFormatter {
  private static cleanMessage(message: string): string {
    return message
      .replace(/^(feat|fix|refactor|chore|docs|style|test|perf):\s*/i, "")
      .trim();
  }

  // TODO : 티켓 추출 로직 외부에서 핸들링 가능하도록 기능 추가
  private static extractTicketInfo(commits: CommitInfo[]): ParsedCommit[] {
    return commits.map((commit) => {
      let key = "-";
      if (commit.description) {
        const ticketMatch = commit.description.match(/[A-Z]+[-_]\d+/);
        if (ticketMatch) {
          key = ticketMatch[0];
        }
      }
      return {
        key,
        message: this.cleanMessage(commit.message),
      };
    });
  }

  private static generateTicketSummary(sortedCommits: ParsedCommit[]): string {
    const ticketSummary = sortedCommits.reduce((acc, { key }) => {
      if (key !== "-") {
        const [ticketType, ticketNumber] = key.split(/[-_]/);
        if (!acc[ticketType]) {
          acc[ticketType] = [];
        }
        acc[ticketType].push(ticketNumber);
      }
      return acc;
    }, {} as TicketSummary);

    return Object.entries(ticketSummary)
      .map(([type, numbers]) => {
        const sortedNumbers = numbers
          .map(Number)
          .sort((a, b) => a - b)
          .join(",");
        return `${type}_${sortedNumbers}`;
      })
      .join(" / ");
  }

  public static format(commits: CommitInfo[]): {
    formattedText: string;
    summaryText: string;
  } {
    const commitWithTickets = this.extractTicketInfo(commits);
    const sortedCommits = commitWithTickets.sort((a, b) => {
      if (a.key === "-") return 1;
      if (b.key === "-") return -1;
      return a.key.localeCompare(b.key);
    });

    const formattedText = sortedCommits
      .map(({ key, message }) => {
        return key === "-" ? `- ${message}` : `- ${key} : ${message}`;
      })
      .join("\n");

    const summaryText = this.generateTicketSummary(sortedCommits);

    return {
      formattedText,
      summaryText,
    };
  }
}
