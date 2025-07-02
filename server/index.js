import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import multer from 'multer';
import cors from 'cors';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/renders', express.static(path.join(__dirname, 'renders')));

// Storage configuration
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/octet-stream' || file.originalname.endsWith('.blend')) {
      cb(null, true);
    } else {
      cb(new Error('Only .blend files are allowed'));
    }
  }
});

// Job management
class RenderJobManager {
  constructor() {
    this.jobs = new Map();
    this.queue = [];
    this.activeJobs = new Set();
    this.maxConcurrentJobs = 2; // Adjust based on system capabilities
  }

  addJob(jobData) {
    const job = {
      id: uuidv4(),
      ...jobData,
      status: 'queued',
      progress: 0,
      createdAt: new Date(),
      startedAt: null,
      completedAt: null,
      error: null,
      outputFiles: []
    };
    
    this.jobs.set(job.id, job);
    this.queue.push(job.id);
    this.processQueue();
    
    return job;
  }

  async processQueue() {
    if (this.activeJobs.size >= this.maxConcurrentJobs || this.queue.length === 0) {
      return;
    }

    const jobId = this.queue.shift();
    const job = this.jobs.get(jobId);
    
    if (!job) return;

    this.activeJobs.add(jobId);
    job.status = 'rendering';
    job.startedAt = new Date();
    
    this.broadcastJobUpdate(job);

    try {
      await this.renderJob(job);
    } catch (error) {
      job.error = error.message;
      job.status = 'failed';
      console.error(`Job ${jobId} failed:`, error);
    } finally {
      this.activeJobs.delete(jobId);
      job.completedAt = new Date();
      this.broadcastJobUpdate(job);
      
      // Process next job in queue
      setTimeout(() => this.processQueue(), 1000);
    }
  }

  async renderJob(job) {
    const { filePath, settings } = job;
    const outputDir = path.join(__dirname, 'renders', job.id);
    await fs.mkdir(outputDir, { recursive: true });

    return new Promise((resolve, reject) => {
      // Construct Blender command
      const blenderArgs = [
        '-b', // Background mode
        filePath,
        '-o', path.join(outputDir, 'frame_####'), // Output pattern
        '-f', settings.frame || '1', // Frame to render
        '--', // End of Blender arguments
        '--cycles-device', settings.device || 'CPU'
      ];

      // Add additional settings
      if (settings.samples) {
        blenderArgs.push('--cycles-samples', settings.samples.toString());
      }

      console.log('Starting Blender render:', 'blender', blenderArgs.join(' '));

      const blenderProcess = spawn('blender', blenderArgs, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';

      blenderProcess.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        
        // Parse progress from Blender output
        const progressMatch = text.match(/Fra:(\d+).*?(\d+\.\d+)%/);
        if (progressMatch) {
          const progress = parseFloat(progressMatch[2]);
          job.progress = Math.min(progress, 100);
          this.broadcastJobUpdate(job);
        }
      });

      blenderProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      blenderProcess.on('close', async (code) => {
        if (code === 0) {
          // Find output files
          try {
            const files = await fs.readdir(outputDir);
            job.outputFiles = files.map(file => ({
              name: file,
              url: `/renders/${job.id}/${file}`,
              size: 0 // Could get actual file size here
            }));
            job.status = 'completed';
            job.progress = 100;
            resolve();
          } catch (error) {
            reject(new Error(`Failed to read output directory: ${error.message}`));
          }
        } else {
          reject(new Error(`Blender process exited with code ${code}: ${errorOutput}`));
        }
      });

      blenderProcess.on('error', (error) => {
        reject(new Error(`Failed to start Blender: ${error.message}`));
      });
    });
  }

  broadcastJobUpdate(job) {
    const message = JSON.stringify({
      type: 'jobUpdate',
      job: job
    });

    wss.clients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(message);
      }
    });
  }

  getJob(id) {
    return this.jobs.get(id);
  }

  getAllJobs() {
    return Array.from(this.jobs.values()).sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );
  }

  cancelJob(id) {
    const job = this.jobs.get(id);
    if (job && job.status === 'queued') {
      job.status = 'cancelled';
      const queueIndex = this.queue.indexOf(id);
      if (queueIndex > -1) {
        this.queue.splice(queueIndex, 1);
      }
      this.broadcastJobUpdate(job);
      return true;
    }
    return false;
  }
}

const jobManager = new RenderJobManager();

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('Client connected');
  
  // Send current jobs to new client
  ws.send(JSON.stringify({
    type: 'jobsList',
    jobs: jobManager.getAllJobs()
  }));

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

// API Routes
app.post('/api/upload', upload.single('blendFile'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  res.json({
    success: true,
    file: {
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: req.file.path,
      size: req.file.size
    }
  });
});

app.post('/api/render', (req, res) => {
  const { filename, settings = {} } = req.body;
  
  if (!filename) {
    return res.status(400).json({ error: 'Filename is required' });
  }

  const filePath = path.join(__dirname, 'uploads', filename);
  
  const job = jobManager.addJob({
    filename,
    filePath,
    settings: {
      frame: settings.frame || 1,
      device: settings.device || 'CPU',
      samples: settings.samples || 128,
      resolution: settings.resolution || '1920x1080'
    }
  });

  res.json({ success: true, job });
});

app.get('/api/jobs', (req, res) => {
  res.json({ jobs: jobManager.getAllJobs() });
});

app.get('/api/jobs/:id', (req, res) => {
  const job = jobManager.getJob(req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  res.json({ job });
});

app.delete('/api/jobs/:id', (req, res) => {
  const success = jobManager.cancelJob(req.params.id);
  if (success) {
    res.json({ success: true });
  } else {
    res.status(400).json({ error: 'Cannot cancel job' });
  }
});

// System info endpoint
app.get('/api/system', (req, res) => {
  res.json({
    blenderAvailable: true, // Could check if Blender is installed
    activeJobs: jobManager.activeJobs.size,
    queuedJobs: jobManager.queue.length,
    totalJobs: jobManager.jobs.size
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Render farm server running on port ${PORT}`);
  console.log('Make sure Blender is installed and available in PATH');
});