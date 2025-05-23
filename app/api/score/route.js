import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    const { userId, score } = body;

    if (userId === undefined || score === undefined) {
      return NextResponse.json(
        { message: 'Missing userId or score' },
        { status: 400 }
      );
    }

    const userKey = `user:${userId}`;

    // Check if user exists
    const userExists = await kv.exists(userKey);
    if (!userExists) {
      return NextResponse.json(
        { message: 'User not found. Please login first.' },
        { status: 404 }
      );
    }

    // Get current score
    const currentScore = await kv.hget(userKey, 'score') || 0;

    // Only update if the new score is higher (or just update regardless - depends on game logic)
    // Let's update if higher for a typical high-score leaderboard
    if (Number(score) > Number(currentScore)) {
        await kv.hset(userKey, { score: Number(score) });
        console.log(`Updated score for user ${userId} to ${score}`);
        return NextResponse.json(
          { message: 'Score updated', newScore: score },
          { status: 200 }
        );
    } else {
        console.log(`New score (${score}) not higher than current score (${currentScore}) for user ${userId}. Not updated.`);
        return NextResponse.json(
          { message: 'Score not updated (new score not higher)', currentScore },
          { status: 200 }
        );
    }

    // --- Alternative: Always update score --- 
    // await kv.hset(userKey, { score: Number(score) });
    // console.log(`Updated score for user ${userId} to ${score}`);
    // return NextResponse.json(
    //   { message: 'Score updated', newScore: score },
    //   { status: 200 }
    // );
    // --- End Alternative ---

  } catch (error) {
    console.error('Error in /api/score:', error);
    return NextResponse.json(
      { message: 'Internal Server Error', error: error.message },
      { status: 500 }
    );
  }
} 