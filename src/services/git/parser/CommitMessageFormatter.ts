import { CommitInfo } from "../types";

interface TicketSummary {
  [key: string]: string[];
}

interface FormattedMessage {
  key: string;
  text: string;
}

export class CommitMessageFormatter {
  private static DEFAULT_TICKET_REGEX = /[A-z]+[-_]\d+/;

  private static async getCurrentRegex(): Promise<RegExp> {
    const { ticketRegex } = (await chrome.storage.local.get("ticketRegex")) as {
      ticketRegex: string;
    };
    if (ticketRegex) {
      try {
        const pattern = ticketRegex.replace(/^\/|\/$/g, "");
        return new RegExp(pattern);
      } catch (error) {
        console.error("Invalid stored regex:", error);
      }
    }
    return this.DEFAULT_TICKET_REGEX;
  }

  public static setTicketRegex(pattern: string): void {
    try {
      chrome.storage.local.set({ ticketRegex: pattern });
    } catch (error) {
      console.error("Invalid regex pattern:", error);
    }
  }

  private static cleanMessage(message: string): string {
    return message
      .replace(/^(feat|fix|refactor|chore|docs|style|test|perf)\s*:\s*/i, "")
      .trim();
  }

  private static async extractTicketInfo(
    commits: CommitInfo[]
  ): Promise<FormattedMessage[]> {
    const regex = await this.getCurrentRegex();

    const getTicketKey = (commit: CommitInfo) => {
      if (commit.description) {
        const ticketMatch = commit.description.match(regex);
        if (ticketMatch) return ticketMatch[0];
      }
      if (commit.message) {
        const ticketMatch = commit.message.match(regex);
        if (ticketMatch) return ticketMatch[0];
      }
      return "-";
    };

    console.log(commits);

    return commits.map((commit) => ({
      key: getTicketKey(commit),
      text: this.cleanMessage(commit.message),
    }));
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

  public static async format(
    commits: CommitInfo[]
  ): Promise<{ messages: FormattedMessage[] }> {
    const commitWithTickets = await this.extractTicketInfo(commits);
    console.log(commitWithTickets);
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
