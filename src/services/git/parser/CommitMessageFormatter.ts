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
    return commits.map((commit) => {
      let key = "-";
      let targetNumber: string | undefined;

      if (commit.description) {
        const ticketMatch = commit.description.match(/[A-Z]+[-_]\d+/);
        if (ticketMatch) {
          key = ticketMatch[0];
        }

        // QA_숫자 형식 추출
        const targetMatch = commit.description.match(/QA[-_]\d+/);
        if (targetMatch) {
          targetNumber = targetMatch[0];
        }
      }

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
          .map(Number)
          .sort((a, b) => a - b)
          .join(",");
        return `${type}_${sortedNumbers}`;
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
