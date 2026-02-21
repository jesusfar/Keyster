"""
Unit tests for Anthropic API Scanner
"""

import os
import sqlite3
import tempfile
import pytest
from datetime import date

from manager import DatabaseManager, ProgressManager, CookieManager


class TestDatabaseManager:
    """Tests for DatabaseManager class"""

    @pytest.fixture
    def temp_db(self):
        """Create a temporary database for testing"""
        fd, path = tempfile.mkstemp(suffix=".db")
        os.close(fd)
        yield path
        if os.path.exists(path):
            os.remove(path)

    def test_create_database(self, temp_db):
        """Test database creation"""
        with DatabaseManager(temp_db) as mgr:
            mgr.cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = [row[0] for row in mgr.cur.fetchall()]
            assert "APIKeys" in tables
            assert "URLs" in tables

    def test_insert_and_get_key(self, temp_db):
        """Test inserting and retrieving a key"""
        with DatabaseManager(temp_db) as mgr:
            mgr.insert("test_key_123", "yes")
            assert mgr.key_exists("test_key_123")
            assert not mgr.key_exists("nonexistent_key")

    def test_insert_duplicate(self, temp_db):
        """Test inserting duplicate keys"""
        with DatabaseManager(temp_db) as mgr:
            mgr.insert("test_key_123", "yes")
            mgr.insert("test_key_123", "no")
            mgr.cur.execute("SELECT COUNT(*) FROM APIKeys WHERE apiKey='test_key_123'")
            count = mgr.cur.fetchone()[0]
            assert count == 2

    def test_delete_key(self, temp_db):
        """Test deleting a key"""
        with DatabaseManager(temp_db) as mgr:
            mgr.insert("test_key_123", "yes")
            assert mgr.key_exists("test_key_123")
            mgr.delete("test_key_123")
            assert not mgr.key_exists("test_key_123")

    def test_all_keys(self, temp_db):
        """Test getting all keys with specific status"""
        with DatabaseManager(temp_db) as mgr:
            mgr.insert("key1", "yes")
            mgr.insert("key2", "no")
            mgr.insert("key3", "yes")
            
            available = mgr.all_keys()
            assert len(available) == 2

    def test_deduplication(self, temp_db):
        """Test deduplication functionality"""
        with DatabaseManager(temp_db) as mgr:
            mgr.insert("key1", "yes")
            mgr.insert("key1", "no")
            mgr.insert("key2", "yes")
            
            mgr.deduplicate()
            
            mgr.cur.execute("SELECT COUNT(*) FROM APIKeys")
            count = mgr.cur.fetchone()[0]
            assert count == 2

    def test_url_operations(self, temp_db):
        """Test URL insert and get operations"""
        with DatabaseManager(temp_db) as mgr:
            mgr.insert_url("https://github.com/test")
            result = mgr.get_url("https://github.com/test")
            assert result is not None


class TestProgressManager:
    """Tests for ProgressManager class"""

    @pytest.fixture
    def temp_progress_file(self):
        """Create a temporary progress file"""
        fd, path = tempfile.mkstemp()
        os.close(fd)
        yield path
        if os.path.exists(path):
            os.remove(path)

    def test_save_and_load_progress(self, temp_progress_file):
        """Test saving and loading progress"""
        pm = ProgressManager(temp_progress_file)
        pm.save(5, 10)
        loaded = pm.load(10)
        assert loaded == 5

    def test_load_nonexistent(self):
        """Test loading nonexistent progress file"""
        pm = ProgressManager("nonexistent_file.txt")
        result = pm.load(10)
        assert result == 0


class TestCookieManager:
    """Tests for CookieManager class (mock tests)"""

    def test_placeholder(self):
        """Placeholder test - actual Selenium tests would require browser"""
        assert True
