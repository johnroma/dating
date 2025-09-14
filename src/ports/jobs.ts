/**
 * Simple job port so we can background tasks later.
 * Inline for now; swap via _setJobsForTests or future adapter.
 */
export type Job =
  | { name: 'resize'; payload: { photoId: string } }
  | { name: 'delete_variants'; payload: { photoId: string; origKey: string } };

export interface JobPort {
  enqueue(job: Job): Promise<void>;
  runInline(job: Job): Promise<void>;
}

class InlineJobs implements JobPort {
  async enqueue(job: Job) {
    await this.runInline(job);
  }
  async runInline(_job: Job) {
    // no-op placeholder; future steps can call storage helpers here
  }
}

let impl: JobPort = new InlineJobs();

export function getJobs(): JobPort {
  return impl;
}
export function _setJobsForTests(j: JobPort) {
  impl = j;
}

