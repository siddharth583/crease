import { useCallback } from 'react';
import { backupFileName, makeBackup, parseBackup, recordBookFileName } from '../engine/backup.ts';
import { recordBookHtml } from '../engine/recordBook.ts';
import type { Match } from '../engine/types.ts';
import type { ToastTone } from '../components/ui.tsx';
import { matchReportHtml } from '../engine/report.ts';
import { pickTextFile, savePdf, saveTextFile } from './files.ts';
import { useMatches } from './matches.tsx';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 'es'}`;

/** Export one match or all of them as a file, and import files others shared, reporting back through a toast. */
export function useMatchFiles(notify: (text: string, tone?: ToastTone) => void) {
  const { matches, savedTeams, importMatches } = useMatches();

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
        const result = await savePdf(backupFileName(which, new Date(), 'pdf'), matchReportHtml(which, matches));
        if (result === 'downloaded') notify('Choose “Save as PDF” in the print window');
        if (result === 'shared') notify('Scorecard PDF ready to send');
      } catch {
        notify('Couldn’t make the PDF. Try again.', 'error');
      }
    },
    [notify, matches],
  );

  /** The record book: a PDF to read, or a file of every match that loads the whole book on another phone. */
  const exportRecordBook = useCallback(
    async (format: 'pdf' | 'file') => {
      if (!matches.length) return notify('No matches yet: the record book fills up as you play.', 'info');
      try {
        if (format === 'pdf') {
          const result = await savePdf(recordBookFileName(new Date(), 'pdf'), recordBookHtml(matches));
          if (result === 'downloaded') notify('Choose “Save as PDF” in the print window');
          if (result === 'shared') notify('Record book PDF ready to send');
        } else {
          const result = await saveTextFile(recordBookFileName(new Date(), 'json'), JSON.stringify(makeBackup(matches, savedTeams)));
          if (result === 'downloaded') notify(`Record book saved to your downloads (${plural(matches.length, 'match')})`);
          if (result === 'shared') notify('Record book file ready to send');
        }
      } catch {
        notify(format === 'pdf' ? 'Couldn’t make the PDF. Try again.' : 'Couldn’t export. Try again.', 'error');
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
      if (!file.matches.length) return notify('There are no matches in that file.', 'info');
      const { added, updated } = importMatches(file.matches, file.teams);
      const parts = [added && `${plural(added, 'match')} added`, updated && `${plural(updated, 'match')} updated`].filter(Boolean);
      notify(parts.length ? `${parts.join(', ')}. ${done}` : 'You already have everything in that file.', parts.length ? 'success' : 'info');
    } catch (e) {
      notify(e instanceof Error && e.message.includes('Crease') ? e.message : 'Couldn’t read that file.', 'error');
    }
  }, [importMatches, notify]);

  return { exportMatches, exportPdf, exportAll: () => exportMatches(matches), exportRecordBook, importFile };
}
