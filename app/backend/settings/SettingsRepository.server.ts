import type { AppSettings } from "@prisma/client";
import prisma from "app/db.server";
import type { ParcelWeightSettings } from "app/commons/settings/ParcelWeightSettings";

/** The AppSettings table holds exactly one row, under this id. */
export const SETTINGS_SINGLETON_ID = "singleton";

export type SettingsPatch = Partial<
  Pick<
    AppSettings,
    | "parcelWeightLimitKg"
    | "autoSplitHeavyOrders"
    | "packStartWeekdays"
    | "jobsOnlyInPacks"
  >
>;

export class SettingsRepository {
  /**
   * Reads the settings row, creating it with the schema defaults on first
   * access. Read-then-create rather than an upsert, so the usual case is a
   * plain SELECT with no write.
   */
  static async get(): Promise<AppSettings> {
    const existing = await prisma.appSettings.findUnique({
      where: { id: SETTINGS_SINGLETON_ID },
    });
    if (existing) return existing;

    try {
      return await prisma.appSettings.create({
        data: { id: SETTINGS_SINGLETON_ID },
      });
    } catch {
      // another request created the row between our SELECT and INSERT
      const row = await prisma.appSettings.findUnique({
        where: { id: SETTINGS_SINGLETON_ID },
      });
      if (row) return row;
      throw new Error("Failed to create the AppSettings row.");
    }
  }

  static async getParcelWeight(): Promise<ParcelWeightSettings> {
    const { parcelWeightLimitKg, autoSplitHeavyOrders } = await this.get();
    return { parcelWeightLimitKg, autoSplitHeavyOrders };
  }

  static async update(patch: SettingsPatch): Promise<AppSettings> {
    return prisma.appSettings.upsert({
      where: { id: SETTINGS_SINGLETON_ID },
      update: patch,
      create: { id: SETTINGS_SINGLETON_ID, ...patch },
    });
  }
}
