# Video Streaming Application

A video streaming application built with NestJS backend and Next.js frontend that allows you to stream videos chunk by chunk.

## Features

- **Video Listing**: Display all videos from the backend data folder
- **Video Streaming**: Stream videos with proper HTTP range requests for chunk-by-chunk playback
- **Video Thumbnails**: Auto-generated thumbnails (JPG with ffmpeg, SVG fallback) with video metadata and play button (included in API response)
- **YouTube-like Interface**: Modern, responsive UI with video thumbnails and modal player
- **Auto-Play**: Videos automatically start playing when clicked
- **Cross-Origin Support**: CORS enabled for frontend-backend communication

## Project Structure

```
streaming/
├── backend/          # NestJS API server
│   ├── data/         # Video files directory
│   └── src/          # Backend source code
└── frontend/         # Next.js frontend application
    └── app/          # Frontend source code
```

## API Endpoints

### Backend (NestJS - Port 5001)

- `GET /videos` - Get list of all available videos with thumbnail URLs (auto-generates thumbnails if missing)
- `GET /videos/stream/:filename` - Stream video by filename with range support
- `GET /videos/thumbnail/:filename` - Generate SVG thumbnail for video

## Setup and Running

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Backend Setup

1. Navigate to the backend directory:

   ```bash
   cd backend
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Add video files to the `data/` folder (MP4, AVI, MOV, MKV supported)

4. Start the development server:
   ```bash
   npm run start:dev
   ```

The backend will run on `http://localhost:3000`

### Frontend Setup

1. Navigate to the frontend directory:

   ```bash
   cd frontend
   ```

2. Install dependencies:

   ```bash
   npm install --legacy-peer-deps
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

The frontend will run on `http://localhost:3001`

## Usage

1. Open your browser and go to `http://localhost:3001`
2. You'll see all videos from the backend data folder displayed in a grid
3. Click on any video thumbnail to open the video player modal
4. The video will stream chunk by chunk with proper seeking support

## Video Streaming Features

- **Range Requests**: Supports HTTP range requests for efficient streaming
- **Seeking**: Users can seek to any position in the video
- **Chunked Transfer**: Videos are served in chunks for better performance
- **Browser Compatibility**: Works with all modern browsers that support HTML5 video

## Adding Videos

Simply place your video files (MP4, AVI, MOV, MKV) in the `backend/data/` folder and restart the backend server. The videos will automatically appear in the frontend interface.

## Technologies Used

- **Backend**: NestJS, TypeScript, Express
- **Frontend**: Next.js, React, TypeScript, Tailwind CSS
- **Icons**: Lucide React
- **HTTP Client**: Axios
