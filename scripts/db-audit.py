#!/usr/bin/env python3
"""Audit NIP v3 database — check if adapters are running, job health, data freshness."""
import psycopg2
import os
from datetime import datetime, timezone, timedelta

DATABASE_URL = "postgresql://neondb_owner:npg_qtEHgx1KBcD5@ep-fancy-scene-at6y50bs-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require"

def query(conn, sql, params=None):
    cur = conn.cursor()
    cur.execute(sql, params or ())
    return cur.fetchall()

def query_one(conn, sql, params=None):
    cur = conn.cursor()
    cur.execute(sql, params or ())
    return cur.fetchone()

def main():
    conn = psycopg2.connect(DATABASE_URL)
    
    print("=" * 70)
    print("NIP v3 — DATABASE AUDIT")
    print("=" * 70)
    
    # 1. Check what tables exist
    print("\n=== TABLES IN DATABASE ===")
    tables = query(conn, """
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' ORDER BY table_name
    """)
    for t in tables:
        print(f"  {t[0]}")
    
    # 1b. Check JobRun columns
    print("\n=== JobRun COLUMNS ===")
    cols = query(conn, """
        SELECT column_name, data_type FROM information_schema.columns 
        WHERE table_name = 'JobRun' ORDER BY ordinal_position
    """)
    for c in cols:
        print(f"  {c[0]:25} | {c[1]}")
    
    # 2. Check JobRun table for recent job executions
    print("\n=== RECENT JOB RUNS (last 20) ===")
    try:
        runs = query(conn, """
            SELECT job, "startedAt", "finishedAt", status, counts, error
            FROM "JobRun" 
            ORDER BY "startedAt" DESC 
            LIMIT 20
        """)
        if not runs:
            print("  (no job runs found — adapters have NEVER run)")
        else:
            for r in runs:
                job, started, finished, status, counts, error = r
                dur = ""
                if started and finished:
                    try:
                        dur = f" · {int((finished - started).total_seconds())}s"
                    except:
                        pass
                print(f"  {status:7} | {job:25} | {started}{dur}")
                if error:
                    print(f"          ERROR: {error[:200]}")
                if counts:
                    print(f"          counts: {counts}")
    except Exception as e:
        conn.rollback()
        print(f"  Error querying JobRun: {e}")
    
    # 3. Check AdapterHealth
    print("\n=== ADAPTER HEALTH ===")
    try:
        health = query(conn, """
            SELECT "adapterName", "adapterType", status, "lastAttemptAt", "causeMessage"
            FROM "AdapterHealth" 
            ORDER BY "adapterName"
        """)
        if not health:
            print("  (no adapter health records)")
        else:
            for h in health:
                name, atype, status, last_attempt, cause = h
                print(f"  {status:6} | {name:15} | {atype:10} | last: {last_attempt}")
                if cause:
                    print(f"         cause: {cause[:150]}")
    except Exception as e:
        conn.rollback()
        print(f"  Error: {e}")
    
    # 4. Check Watermarks (adapter progress)
    print("\n=== WATERMARKS (adapter cursors) ===")
    try:
        wms = query(conn, """
            SELECT job, value, "updatedAt" FROM "Watermark" ORDER BY "updatedAt" DESC
        """)
        if not wms:
            print("  (no watermarks — adapters haven't progressed)")
        else:
            for w in wms:
                print(f"  {w[0]:25} | wm: {str(w[1])[:60]} | updated: {w[2]}")
    except Exception as e:
        conn.rollback()
        print(f"  Error: {e}")
    
    # 5. Check RawContent freshness
    print("\n=== RAW CONTENT FRESHNESS ===")
    try:
        total = query_one(conn, 'SELECT COUNT(*) FROM "RawContent"')[0]
        print(f"  Total raw contents: {total}")
        
        # Last 7 days
        recent = query_one(conn, """
            SELECT COUNT(*) FROM "RawContent" 
            WHERE "fetchedAt" > NOW() - INTERVAL '7 days'
        """)[0]
        print(f"  Last 7 days: {recent}")
        
        # Last 24 hours
        today = query_one(conn, """
            SELECT COUNT(*) FROM "RawContent" 
            WHERE "fetchedAt" > NOW() - INTERVAL '24 hours'
        """)[0]
        print(f"  Last 24 hours: {today}")
        
        # Most recent 5
        print("\n  Most recent 5 raw contents:")
        recent_items = query(conn, """
            SELECT title, "adapterType", "fetchedAt", "extractionStatus"
            FROM "RawContent" 
            ORDER BY "fetchedAt" DESC 
            LIMIT 5
        """)
        for r in recent_items:
            print(f"    {r[3]:12} | {r[1]:8} | {r[2]} | {str(r[0])[:60]}")
    except Exception as e:
        conn.rollback()
        print(f"  Error: {e}")
    
    # 6. Check Authors (sources)
    print("\n=== SOURCES (Authors) ===")
    try:
        total_authors = query_one(conn, 'SELECT COUNT(*) FROM "Author"')[0]
        active_authors = query_one(conn, 'SELECT COUNT(*) FROM "Author" WHERE COALESCE("paused", false) = false')[0]
        with_feed = query_one(conn, 'SELECT COUNT(*) FROM "Author" WHERE COALESCE("feedUrl", \'\') <> \'\'')[0]
        print(f"  Total authors: {total_authors}")
        print(f"  Active (not paused): {active_authors}")
        print(f"  With RSS feed URL: {with_feed}")
    except Exception as e:
        conn.rollback()
        print(f"  Error: {e}")
    
    # 7. Check extraction status
    print("\n=== EXTRACTION STATUS ===")
    try:
        statuses = query(conn, """
            SELECT "extractionStatus", COUNT(*) 
            FROM "RawContent" 
            GROUP BY "extractionStatus" 
            ORDER BY COUNT(*) DESC
        """)
        for s in statuses:
            print(f"  {s[0]:20} | {s[1]}")
    except Exception as e:
        conn.rollback()
        print(f"  Error: {e}")
    
    # 8. Check Queue items
    print("\n=== QUEUE ITEMS ===")
    try:
        open_count = query_one(conn, 'SELECT COUNT(*) FROM "QueueItem" WHERE status = \'OPEN\'')[0]
        total_count = query_one(conn, 'SELECT COUNT(*) FROM "QueueItem"')[0]
        print(f"  Open: {open_count} / Total: {total_count}")
    except Exception as e:
        conn.rollback()
        print(f"  Error: {e}")
    
    # 9. Check Theses
    print("\n=== THESES ===")
    try:
        stages = query(conn, """
            SELECT stage, COUNT(*) FROM "Thesis" GROUP BY stage ORDER BY COUNT(*) DESC
        """)
        for s in stages:
            print(f"  {s[0]:15} | {s[1]}")
    except Exception as e:
        conn.rollback()
        print(f"  Error: {e}")
    
    conn.close()
    print("\n" + "=" * 70)
    print("AUDIT COMPLETE")
    print("=" * 70)

if __name__ == "__main__":
    main()
