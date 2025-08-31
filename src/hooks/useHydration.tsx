import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { format } from 'date-fns';

interface HydrationLog {
  id: string;
  cups: number;
  logged_at: string;
  log_date: string;
}

export function useHydration() {
  const [hydrationLogs, setHydrationLogs] = useState<HydrationLog[]>([]);
  const [todayTotal, setTodayTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();

  const loadHydrationLogs = async (startDate?: string, endDate?: string) => {
    if (!user) return;

    setIsLoading(true);
    try {
      let query = supabase
        .from('hydration_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('logged_at', { ascending: false });

      if (startDate && endDate) {
        query = query.gte('log_date', startDate).lte('log_date', endDate);
      } else {
        // Default to today
        const today = format(new Date(), 'yyyy-MM-dd');
        query = query.eq('log_date', today);
      }

      const { data, error } = await query;

      if (error) throw error;

      setHydrationLogs(data || []);

      // Calculate today's total
      const today = format(new Date(), 'yyyy-MM-dd');
      const todaysLogs = (data || []).filter(log => log.log_date === today);
      const total = todaysLogs.reduce((sum, log) => sum + log.cups, 0);
      setTodayTotal(total);

    } catch (error) {
      console.error('Error loading hydration logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addWater = async (cups: number = 1) => {
    if (!user) return;

    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      
      const { error } = await supabase
        .from('hydration_logs')
        .insert({
          user_id: user.id,
          cups,
          log_date: today
        });

      if (error) throw error;

      // Reload logs
      await loadHydrationLogs();
    } catch (error) {
      console.error('Error adding water:', error);
      throw error;
    }
  };

  const removeWater = async () => {
    if (!user) return;

    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      
      // Find the most recent log for today
      const { data: recentLogs } = await supabase
        .from('hydration_logs')
        .select('id, cups')
        .eq('user_id', user.id)
        .eq('log_date', today)
        .order('logged_at', { ascending: false })
        .limit(1);

      if (recentLogs && recentLogs.length > 0) {
        const log = recentLogs[0];
        
        if (log.cups > 1) {
          // Reduce cups by 1
          await supabase
            .from('hydration_logs')
            .update({ cups: log.cups - 1 })
            .eq('id', log.id);
        } else {
          // Delete the log
          await supabase
            .from('hydration_logs')
            .delete()
            .eq('id', log.id);
        }

        // Reload logs
        await loadHydrationLogs();
      }
    } catch (error) {
      console.error('Error removing water:', error);
      throw error;
    }
  };

  useEffect(() => {
    if (user) {
      loadHydrationLogs();
    }
  }, [user]);

  return {
    hydrationLogs,
    todayTotal,
    isLoading,
    loadHydrationLogs,
    addWater,
    removeWater
  };
}