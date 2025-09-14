import PhotoUploader from '@/components/PhotoUploader';

export default function UploadPage() {
  return (
    <main className='mx-auto max-w-2xl p-6'>
      <h1 className='text-xl font-semibold'>Upload</h1>
      <p className='mt-2 text-gray-700'>
        Upload allowed for creators & moderators.
      </p>
      <PhotoUploader />
    </main>
  );
}
