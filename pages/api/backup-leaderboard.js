import fs from 'fs';
import path from 'path';

const dataFilePath = path.join(process.cwd(), 'public', 'leaderboard-data.json');
const backupDir = path.join(process.cwd(), 'public', 'backups');

export default async function handler(req, res) {
  if (req.method === 'POST') {
    // Create backup
    try {
      // Ensure backup directory exists
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      // Read current data
      if (fs.existsSync(dataFilePath)) {
        const data = fs.readFileSync(dataFilePath, 'utf8');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(backupDir, `leaderboard-backup-${timestamp}.json`);
        
        fs.writeFileSync(backupPath, data);
        
        return res.status(200).json({ 
          message: 'Backup created successfully',
          backupFile: `leaderboard-backup-${timestamp}.json`
        });
      } else {
        return res.status(404).json({ message: 'No data file to backup' });
      }
    } catch (error) {
      console.error('Error creating backup:', error);
      return res.status(500).json({ message: 'Failed to create backup' });
    }
  } else if (req.method === 'GET') {
    // List backups
    try {
      if (!fs.existsSync(backupDir)) {
        return res.status(200).json({ backups: [] });
      }

      const files = fs.readdirSync(backupDir)
        .filter(file => file.startsWith('leaderboard-backup-') && file.endsWith('.json'))
        .map(file => ({
          filename: file,
          created: fs.statSync(path.join(backupDir, file)).mtime,
          size: fs.statSync(path.join(backupDir, file)).size
        }))
        .sort((a, b) => b.created - a.created);

      return res.status(200).json({ backups: files });
    } catch (error) {
      console.error('Error listing backups:', error);
      return res.status(500).json({ message: 'Failed to list backups' });
    }
  } else {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }
} 