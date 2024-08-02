
const fs = require('fs');
const sqlite = require('sqlite3').verbose();

const DEL_DB = false;

if (DEL_DB && fs.existsSync('data/db.sqlite')) {
    fs.unlinkSync('data/db.sqlite');
}


const db = new sqlite.Database('data/db.sqlite', (err) => {
    if (err) throw err;
});

db.run('CREATE TABLE IF NOT EXISTS Book (isbn VARCHAR(13) PRIMARY KEY, title VARCHAR(64) NOT NULL, authors VARCHAR(128) NOT NULL, publish_date VARCHAR(16) NOT NULL, cover_path VARCHAR(64) NOT NULL);');

/**
 * Per salvare i dati fetchati dalle API nel database, gli si passa un dizionario con chiave isbn e item oggetti di questo tipo:
 *
 * {
 *     isbn,
 *     title,
 *     authors,
 *     publish_date,
 *     cover_path
 * }
 */
function insertBooks(books)
{
    let params = [];

    for(const [isbn, book] of Object.entries(books))
    {
        if(typeof book.isbn !== 'string' || !/^[0-9]{9}[0-9X]$/.test(book.isbn) && !/^[0-9]{13}$/.test(book.isbn)) throw new Error('Invalid ISBN');
        if(typeof book.title !== 'string' || book.title.trim() === '') throw new Error('Invalid title');
        if(typeof book.authors !== 'string' || book.authors.trim() === '') throw new Error('Invalid authors');
        if(typeof book.publish_date !== 'string' || book.publish_date.trim() === '') throw new Error('Invalid publish date');
        if(typeof book.cover_path !== 'string' || book.cover_path.trim() === '') throw new Error('Invalid cover path');

        params.push(book.isbn, book.title, book.authors, book.publish_date, book.cover_path);
    }

    db.run(`INSERT INTO Book (isbn, title, authors, publish_date, cover_path) VALUES ${'(?, ?, ?, ?, ?)' + ', (?, ?, ?, ?, ?)'.repeat(Object.keys(books).length - 1)}`, params);
}


async function getBooks(isbns)
{
    isbns = isbns.filter(isbn => typeof isbn === 'string' && (/^[0-9]{9}[0-9X]$/.test(isbn) || /^[0-9]{13}$/.test(isbn)));
    if(isbns.length === 0)
    {
        return {};
    }

    return new Promise((resolve, reject) => {
        db.all(`SELECT * FROM Book WHERE isbn IN (${isbns.map(() => '?').join(',')})`, isbns, (err, rows) => {
            if(err) reject(err);
            const books = {};
            rows.forEach(row => books[row.isbn] = row);
            resolve(books);
        });
    });
}

module.exports = {
    getBooks,
    insertBooks
};