import { CommitInfo } from "../types";

interface TicketSummary {
  [key: string]: string[];
}

interface FormattedMessage {
  key: string;
  text: string;
}

export class CommitMessageFormatter {
  private static cleanMessage(message: string): string {
    return message
      .replace(/^(feat|fix|refactor|chore|docs|style|test|perf):\s*/i, "")
      .trim();
  }

  // TODO : 티켓 추출 로직 외부에서 핸들링 가능하도록 기능 추가
  private static extractTicketInfo(commits: CommitInfo[]): FormattedMessage[] {
    const getTicketKey = (commit: CommitInfo) => {
      if (commit.description) {
        const ticketMatch = commit.description.match(/[A-z]+[-_]\d+/);
        if (ticketMatch) {
          return ticketMatch[0];
        }
      }

      if (commit.message) {
        const ticketMatch = commit.message.match(/[A-z]+[-_]\d+/);
        if (ticketMatch) {
          return ticketMatch[0];
        }
      }

      return "-";
    };

    return commits.map((commit) => {
      const key = getTicketKey(commit);

      return {
        key,
        text: this.cleanMessage(commit.message),
      };
    });
  }

  public static generateKeySummary(commitList: FormattedMessage[]): string {
    const ticketSummary = commitList.reduce((acc, { key }) => {
      if (key) {
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
          .filter(Boolean)
          .map(Number)
          .sort((a, b) => a - b)
          .join(",");
        if (type && sortedNumbers) {
          return `${type}_${sortedNumbers}`;
        }
        return `- ${type || sortedNumbers}`;
      })
      .join(" / ");
  }

  public static format(commits: CommitInfo[]): {
    messages: FormattedMessage[];
  } {
    const commitWithTickets = this.extractTicketInfo(commits);
    const sortedCommits = commitWithTickets.sort((a, b) => {
      if (a.key === "-") return 1;
      if (b.key === "-") return -1;
      return a.key.localeCompare(b.key);
    });

    const messages = sortedCommits.map(({ key, text }) => {
      if (key === "-") {
        return {
          key: "",
          text,
        };
      }
      return {
        key,
        text,
      };
    });

    return {
      messages,
    };
  }
}
