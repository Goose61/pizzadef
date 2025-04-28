// Placeholder for /api/login

import { kv } from '@vercel/kv';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { userId, username } = request.body;

    if (!userId || !username) {
      return response.status(400).json({ message: 'Missing userId or username' });
    }

    // Use userId as the key
    const userKey = `user:${userId}`;

    // Check if user already exists
    const existingUser = await kv.hgetall(userKey);

    if (existingUser) {
      // Update username if it changed, keep score
      if (existingUser.username !== username) {
        await kv.hset(userKey, { username });
        console.log(`Updated username for user ${userId} to ${username}`);
      }
      return response.status(200).json({ message: 'User already exists', user: { ...existingUser, username } });
    } else {
      // Create new user with score 0
      const newUser = { userId: String(userId), username, score: 0 };
      await kv.hset(userKey, newUser);
      // Add user ID to a set for easy retrieval of all users
      await kv.sadd('users', userKey);
      console.log(`Created new user ${userId} (${username})`);
      return response.status(201).json({ message: 'User created', user: newUser });
    }
  } catch (error) {
    console.error('Error in /api/login:', error);
    return response.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
} 