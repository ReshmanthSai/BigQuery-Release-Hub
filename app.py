import os
import urllib.request
import ssl
import xml.etree.ElementTree as ET
import re
from flask import Flask, jsonify, render_template

app = Flask(__name__)

# Feed URL
FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

def clean_html(raw_html):
    """Strips HTML tags and normalizes whitespace to create a text snippet."""
    if not raw_html:
        return ""
    # Remove HTML tags
    cleanr = re.compile('<.*?>')
    cleantext = re.sub(cleanr, '', raw_html)
    # Replace multiple spaces/newlines with a single space
    cleantext = re.sub(r'\s+', ' ', cleantext).strip()
    return cleantext

def split_notes(entry_title, entry_updated, entry_link, entry_content):
    """
    Parses entry HTML and splits it by <h3> tags if they exist.
    This groups content under separate release note cards by type (Feature, Announcement, etc.).
    """
    if not entry_content:
        return []
        
    # Pattern to find <h3>Title</h3> followed by any content until the next <h3> or end of string
    pattern = r'<h3>(.*?)</h3>(.*?(?=(?:<h3>|$)))'
    matches = list(re.finditer(pattern, entry_content, re.DOTALL))
    
    notes = []
    if not matches:
        # Fallback if no <h3> tags are found in the entry
        summary = clean_html(entry_content)
        notes.append({
            'title': f"BigQuery Update - {entry_title}",
            'type': 'Update',
            'date': entry_title,
            'published': entry_updated,
            'link': entry_link,
            'content': entry_content,
            'summary': summary[:250] + ('...' if len(summary) > 250 else '')
        })
        return notes
        
    for match in matches:
        note_type = match.group(1).strip()
        note_html = match.group(2).strip()
        
        # Format a user-friendly card title
        card_title = f"{note_type} - {entry_title}"
        summary = clean_html(note_html)
        summary_truncated = summary[:250] + ('...' if len(summary) > 250 else '')
        
        # Use specific heading type or fallback to general note link
        notes.append({
            'title': card_title,
            'type': note_type,
            'date': entry_title,
            'published': entry_updated,
            'link': entry_link,
            'content': f"<h3>{note_type}</h3>\n{note_html}",
            'summary': summary_truncated
        })
    return notes

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/notes')
def get_notes():
    try:
        # Create unverified SSL context to bypass macOS local certificate verification issues
        context = ssl._create_unverified_context()
        req = urllib.request.Request(
            FEED_URL, 
            headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'}
        )
        with urllib.request.urlopen(req, context=context, timeout=10) as response:
            xml_data = response.read()
            
        root = ET.fromstring(xml_data)
        namespaces = {'atom': 'http://www.w3.org/2005/Atom'}
        
        all_notes = []
        for entry in root.findall('atom:entry', namespaces):
            title_el = entry.find('atom:title', namespaces)
            title = title_el.text.strip() if title_el is not None and title_el.text else ""
            
            updated_el = entry.find('atom:updated', namespaces)
            updated = updated_el.text.strip() if updated_el is not None and updated_el.text else ""
            
            link_el = entry.find('atom:link', namespaces)
            link = ""
            if link_el is not None:
                link = link_el.attrib.get('href', '')
                
            content_el = entry.find('atom:content', namespaces)
            content = content_el.text.strip() if content_el is not None and content_el.text else ""
            
            all_notes.extend(split_notes(title, updated, link, content))
            
        return jsonify({
            'success': True,
            'count': len(all_notes),
            'notes': all_notes
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True, port=5001)
