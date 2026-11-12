import importlib.util
from pathlib import Path
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

    def test_invalid_or_missing_new_file_is_not_silently_accepted(self):
        with tempfile.TemporaryDirectory() as temp:
            with self.assertRaisesRegex(ValueError, 'NEW_HTML_NOT_REGULAR'):
                check.missing_new_pages(Path(temp), ['public/page.html'], {'items': []})


if __name__ == '__main__':
    unittest.main()
