import { useCallback } from 'react';
import { backupFileName, fullBackupFileName, makeBackup, parseBackup, recordBookFileName } from '../engine/backup.ts';
import { recordBookHtml } from '../engine/recordBook.ts';
import type { Match } from '../engine/types.ts';
import type { ToastTone } from '../components/ui.tsx';
import { matchReportHtml } from '../engine/report.ts';
import { pickTextFile, savePdf, saveReportImage, saveTextFile } from './files.ts';
import { useMatches } from './matches.tsx';
import { useSquad } from './squad.ts';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 'es'}`;

/** Export one match or all of them as a file, and import files others shared, reporting back through a toast. */
export function useMatchFiles(notify: (text: string, tone?: ToastTone) => void) {
  const { matches, savedTeams, importMatches } = useMatches();
  const { squad, auctions, importSquad } = useSquad();

  /** Everything on this phone in one file: every match, the saved sides, the squad and the auctions. */
  const exportEverything = useCallback(async () => {
    try {
      const result = await saveTextFile(fullBackupFileName(), JSON.stringify(makeBackup(matches, savedTeams, { squad, auctions })));
      const what = `${plural(matches.length, 'match')}, ${squad.length} players${auctions.length ? `, ${auctions.length} auction${auctions.length === 1 ? '' : 's'}` : ''}`;
      if (result === 'downloaded') notify(`Backup saved to your downloads: ${what}`);
      if (result === 'shared') notify(`Backup ready to send: ${what}`);
      return result === 'downloaded' || result === 'shared';
    } catch {
      notify('Couldn’t make the backup. Try again.', 'error');
      return false;
    }
  }, [matches, savedTeams, squad, auctions, notify]);

  const exportMatches = useCallback(
    async (which: Match[]) => {
      if (!which.length) return notify('No matches to export yet.', 'info');
      // A single match carries its own squads; a full export also carries the saved squads.
      const teams = which.length === 1 ? which[0].teams : savedTeams;
      try {
        const result = await saveTextFile(backupFileName(which), JSON.stringify(makeBackup(which, teams)));
        if (result === 'downloaded') notify(`Saved ${plural(which.length, 'match')} to your downloads`);
        if (result === 'shared') notify('Match file ready to send');
      } catch {
        notify('Couldn’t export. Try again.', 'error');
      }
    },
    [savedTeams, notify],
  );

  const exportPdf = useCallback(
    async (which: Match[]) => {
      if (!which.length) return notify('Pick at least one match.', 'info');
      try {
        notify('Making the PDF…', 'info');
        const result = await savePdf(backupFileName(which, new Date(), 'pdf'), matchReportHtml(which, matches));
        if (result === 'downloaded') notify('PDF saved to your downloads');
        if (result === 'shared') notify('Scorecard PDF ready to send');
      } catch {
        notify('Couldn’t make the PDF. Try again.', 'error');
      }
    },
    [notify, matches],
  );

  /** Each match as a picture of its scorecard: one image a match, named like its PDF. */
  const exportImage = useCallback(
    async (which: Match[]) => {
      if (!which.length) return notify('Pick at least one match.', 'info');
      try {
        notify(which.length === 1 ? 'Making the picture…' : `Making ${which.length} pictures…`, 'info');
        let result: Awaited<ReturnType<typeof saveReportImage>> = 'cancelled';
        for (const m of which) result = await saveReportImage(backupFileName([m], new Date(), 'png'), matchReportHtml([m], matches));
        if (result === 'downloaded') notify(which.length === 1 ? 'Picture saved to your downloads' : `${which.length} pictures saved to your downloads`);
        if (result === 'shared') notify('Scorecard ready to send');
      } catch {
        notify('Couldn’t make the picture. Try again.', 'error');
      }
    },
    [notify, matches],
  );

  /** Export chosen matches in the format picked in the export sheet. */
  const exportAs = useCallback(
    (format: 'pdf' | 'image' | 'file', which: Match[]) => (format === 'pdf' ? exportPdf(which) : format === 'image' ? exportImage(which) : exportMatches(which)),
    [exportPdf, exportImage, exportMatches],
  );

  /** The record book: a PDF or picture to read, or a file of every match that loads the whole book on another phone. */
  const exportRecordBook = useCallback(
    async (format: 'pdf' | 'image' | 'file') => {
      if (!matches.length) return notify('No matches yet: the record book fills up as you play.', 'info');
      try {
        if (format === 'image') {
          notify('Making the picture…', 'info');
          const result = await saveReportImage(recordBookFileName(new Date(), 'png'), recordBookHtml(matches));
          if (result === 'downloaded') notify('Record book picture saved to your downloads');
          if (result === 'shared') notify('Record book ready to send');
        } else if (format === 'pdf') {
          notify('Making the PDF…', 'info');
          const result = await savePdf(recordBookFileName(new Date(), 'pdf'), recordBookHtml(matches));
          if (result === 'downloaded') notify('Record book PDF saved to your downloads');
          if (result === 'shared') notify('Record book PDF ready to send');
        } else {
          const result = await saveTextFile(recordBookFileName(new Date(), 'json'), JSON.stringify(makeBackup(matches, savedTeams)));
          if (result === 'downloaded') notify(`Record book saved to your downloads (${plural(matches.length, 'match')})`);
          if (result === 'shared') notify('Record book file ready to send');
        }
      } catch {
        notify(format === 'pdf' ? 'Couldn’t make the PDF. Try again.' : format === 'image' ? 'Couldn’t make the picture. Try again.' : 'Couldn’t export. Try again.', 'error');
      }
    },
    [matches, savedTeams, notify],
  );

  /** `done` says what the import brought up to date: the player stats, or the record book. */
  const importFile = useCallback(async (done = 'Player stats are up to date.') => {
    try {
      const text = await pickTextFile();
      if (text === null) return;
      const file = parseBackup(text);
      if (!file.matches.length && !file.squad?.length) return notify('There are no matches in that file.', 'info');
      // The squad first: it's how a player is known as one person on either side when their matches are counted.
      const fromSquad = importSquad(file.squad, file.auctions);
      const { added, updated } = importMatches(file.matches, file.teams);
      const parts = [
        added && `${plural(added, 'match')} added`,
        updated && `${plural(updated, 'match')} updated`,
        fromSquad.players && `${fromSquad.players} squad player${fromSquad.players === 1 ? '' : 's'} added or updated`,
        fromSquad.auctions && `${fromSquad.auctions} auction${fromSquad.auctions === 1 ? '' : 's'} added`,
      ].filter(Boolean);
      notify(parts.length ? `${parts.join(', ')}. ${done}` : 'You already have everything in that file.', parts.length ? 'success' : 'info');
    } catch (e) {
      notify(e instanceof Error && e.message.includes('Crease') ? e.message : 'Couldn’t read that file.', 'error');
    }
  }, [importMatches, importSquad, notify]);

  return { exportMatches, exportPdf, exportImage, exportAs, exportAll: () => exportMatches(matches), exportEverything, exportRecordBook, importFile };
}
