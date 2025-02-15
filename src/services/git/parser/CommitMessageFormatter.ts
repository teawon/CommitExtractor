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
  private static DEFAULT_CLEAN_REGEX =
    /^(feat|fix|refactor|chore|docs|style|test|perf)\s*:\s*/;

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

  private static async getCurrentCleanRegex(): Promise<RegExp> {
    const { cleanRegex } = (await chrome.storage.local.get("cleanRegex")) as {
      cleanRegex: string;
    };
    if (cleanRegex) {
      try {
        const pattern = cleanRegex.replace(/^\/|\/$/g, "");
        return new RegExp(pattern);
      } catch (error) {
        console.error("Invalid stored clean regex:", error);
      }
    }
    return this.DEFAULT_CLEAN_REGEX;
  }

  public static setTicketRegex(pattern: string): void {
    try {
      chrome.storage.local.set({ ticketRegex: pattern });
    } catch (error) {
      console.error("Invalid regex pattern:", error);
    }
  }

  public static setCleanRegex(pattern: string): void {
    try {
      chrome.storage.local.set({ cleanRegex: pattern });
    } catch (error) {
      console.error("Invalid clean regex pattern:", error);
    }
  }

  public static getDefaultTicketPattern(): string {
    return this.DEFAULT_TICKET_REGEX.source;
  }

  public static getDefaultCleanPattern(): string {
    return this.DEFAULT_CLEAN_REGEX.source;
  }

  private static async cleanMessage(message: string): Promise<string> {
    const regex = await this.getCurrentCleanRegex();
    return message.replace(regex, "").trim();
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

    const messages = [];
    for (const commit of commits) {
      messages.push({
        key: getTicketKey(commit),
        text: await this.cleanMessage(commit.message),
      });
    }
    return messages;
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
