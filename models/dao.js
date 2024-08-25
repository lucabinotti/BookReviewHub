
const fs = require('fs');
const sqlite = require('sqlite3').verbose();

const DEL_DB = false;

if (DEL_DB && fs.existsSync('data/db.sqlite')) {
    fs.unlinkSync('data/db.sqlite');
}


const db = new sqlite.Database('data/db.sqlite', (err) => {
    if (err) throw err;
});

db.run('CREATE TABLE IF NOT EXISTS Book (isbn VARCHAR(13) PRIMARY KEY, title VARCHAR(64) NOT NULL, authors VARCHAR(128) DEFAULT NULL, publish_date VARCHAR(16) NOT NULL, publishers VARCHAR(128) DEFAULT NULL, cover_path VARCHAR(64) NOT NULL);');
db.run('CREATE TABLE IF NOT EXISTS Review (isbn VARCHAR(13), user INT UNSIGNED, stars TINYINT NOT NULL, text VARCHAR(256) DEFAULT NULL, date TEXT NOT NULL, PRIMARY KEY(isbn, user));')

/**
 * Per salvare i dati fetchati dalle API nel database, gli si passa un dizionario con chiave isbn e item oggetti di questo tipo:
 *
 * {
 *     isbn,
 *     title,
 *     authors,
 *     publish_date,
 *     publishers,
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
        if(book.authors !== null && (typeof book.authors !== 'string' || book.authors.trim() === '')) throw new Error('Invalid authors');
        if(typeof book.publish_date !== 'string' || book.publish_date.trim() === '') throw new Error('Invalid publish date');
        if(book.publishers !== null && (typeof book.publishers !== 'string' || book.publishers.trim() === '')) throw new Error('Invalid publishers');
        if(typeof book.cover_path !== 'string' || book.cover_path.trim() === '') throw new Error('Invalid cover path');

        params.push(book.isbn, book.title, book.authors, book.publish_date, book.publishers, book.cover_path);
    }

    db.run(`INSERT INTO Book (isbn, title, authors, publish_date, publishers, cover_path) VALUES ${'(?, ?, ?, ?, ?, ?)' + ', (?, ?, ?, ?, ?, ?)'.repeat(Object.keys(books).length - 1)}`, params);
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

function insertReview(isbn, user, stars, text)
{
    if(typeof isbn !== 'string' || !/^[0-9]{9}[0-9X]$/.test(isbn) && !/^[0-9]{13}$/.test(isbn)) throw new Error('Invalid ISBN');
    if(typeof user !== 'number' || user < 0) throw new Error('Invalid user');
    if(typeof stars !== 'number' || stars < 1 || stars > 5) throw new Error('Invalid stars');
    if(typeof text !== 'string' || text.length > 256) throw new Error('Invalid text');

    db.run('INSERT INTO Review (isbn, user, stars, text, date) VALUES (?, ?, ?, ?, ?)', [isbn, user, stars, text, new Date().toISOString()]);
}

async function getReviews(isbn)
{
    if(typeof isbn !== 'string' || !/^[0-9]{9}[0-9X]$/.test(isbn) && !/^[0-9]{13}$/.test(isbn)) throw new Error('Invalid ISBN');

    return new Promise((resolve, reject) => {
        db.all(`SELECT isbn, user, stars, text, date FROM Review WHERE isbn = ?`, isbn, (err, rows) => {
            if(err) reject(err);
            // const books = [];
            // rows.forEach(row => books[row.isbn] = row);
            resolve(rows);
        });
    });
}

async function getSimilarBooks(title)
{
    if(typeof title !== 'string') throw new Error('Invalid title');

    return new Promise((resolve, reject) => {
        db.all(`SELECT title FROM Book WHERE title LIKE ? LIMIT 10`, `%${title}%`, (err, rows) => {
            if(err) reject(err);
            // const books = [];
            // rows.forEach(row => books[row.isbn] = row);
            resolve(rows);
        });
    });
}

module.exports = {
    getBooks,
    insertBooks,
    insertReview,
    getReviews,
    getSimilarBooks
};