import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parent.parent / 'scripts/check_site_search_freshness.py'
spec = importlib.util.spec_from_file_location('search_freshness', SCRIPT)
check = importlib.util.module_from_spec(spec)
spec.loader.exec_module(check)


class FreshnessTest(unittest.TestCase):
    def test_new_public_pages_need_catalogue_entries(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            pages = root / 'public' / 'new'
            pages.mkdir(parents=True)
            (pages / 'index.html').write_text('<html><title>Public project</title></html>')
            (pages / 'article.html').write_text('<html><title>Article</title></html>')
            names = ['public/new/index.html', 'public/new/article.html']
            index = {'items': [{'url': '/new/', 'title': 'New project'}]}
            self.assertEqual(check.missing_new_pages(root, names, index), ['public/new/article.html'])
            index['items'].append({'url': '/new/article', 'title': ''})
            self.assertEqual(check.missing_new_pages(root, names, index), ['public/new/article.html'])
            index['items'][-1]['title'] = 'Article'  # Netlify clean URL.
            self.assertEqual(check.missing_new_pages(root, names, index), [])

    def test_private_and_noindex_pages_are_not_forced_public(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            hidden = root / 'public' / 'draft.html'
            hidden.parent.mkdir(parents=True)
            hidden.write_text('<meta content="noindex, nofollow" name="robots"><title>Draft</title>')
            names = ['public/draft.html', 'public/BD/O/secret.html', 'public/WL/index.html']
            self.assertEqual(check.missing_new_pages(root, names, {'items': []}), [])

    def test_unindexed_page_remains_detectable_after_an_unrelated_commit(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            def git(*args):
                return subprocess.run(['git', '-C', str(root), '-c', 'user.name=Fixture',
                                       '-c', 'user.email=fixture@example.invalid', *args],
                                      check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                      text=True).stdout.strip()
            git('init', '-q')
            (root / 'README').write_text('baseline')
            git('add', 'README'); git('commit', '-qm', 'baseline')
            baseline = git('rev-parse', 'HEAD')
            (root / 'public').mkdir()
            (root / 'public' / 'new.html').write_text('<html>New work</html>')
            git('add', 'public'); git('commit', '-qm', 'new unindexed page')
            previous = git('rev-parse', 'HEAD')
            (root / 'README').write_text('unrelated later update')
            git('add', 'README'); git('commit', '-qm', 'unrelated update')
            head = git('rev-parse', 'HEAD')
            self.assertEqual(check.added_paths(root, previous, head), [])
            names = check.added_paths(root, baseline, head)
            self.assertEqual(check.missing_new_pages(root, names, {'items': []}), ['public/new.html'])
            self.assertEqual(check.missing_new_pages(root, names, {'items': [
                {'url': '/new.html', 'title': 'New work'}]}), [])

    def test_invalid_or_missing_new_file_is_not_silently_accepted(self):
        with tempfile.TemporaryDirectory() as temp:
            with self.assertRaisesRegex(ValueError, 'NEW_HTML_NOT_REGULAR'):
                check.missing_new_pages(Path(temp), ['public/page.html'], {'items': []})


if __name__ == '__main__':
    unittest.main()
