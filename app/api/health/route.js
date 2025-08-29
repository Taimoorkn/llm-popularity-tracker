import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

export async function GET() {
  try {
    // Test Supabase connection
    const { data, error } = await supabase
      .from('llms')
      .select('count')
      .limit(1);

    const healthy = !error;

    return NextResponse.json({
      status: healthy ? 'healthy' : 'unhealthy',
      service: 'llm-popularity-tracker',
      timestamp: new Date().toISOString(),
      supabase: {
        connected: healthy,
        error: error?.message
      }
    }, {
      status: healthy ? 200 : 503
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      service: 'llm-popularity-tracker',
      timestamp: new Date().toISOString(),
      error: error.message
    }, {
      status: 503
    });
  }
}