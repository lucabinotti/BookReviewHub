'use strict';

const fs = require('fs');
const sqlite = require('sqlite3').verbose();

const INIT_DB = false;

if(INIT_DB && fs.existsSync('data/db.sqlite')) {
    fs.unlinkSync('data/db.sqlite');
}

const db = new sqlite.Database('data/db.sqlite', (err) => {
    if (err) throw err;
});

if(INIT_DB)
{
    db.run('CREATE TABLE IF NOT EXISTS User (id VARCHAR(20) PRIMARY KEY, username VARCHAR(64), profile_pic VARCHAR(64), is_mod BOOLEAN NOT NULL);', () => {
        db.run('CREATE TABLE IF NOT EXISTS Book (isbn VARCHAR(13) PRIMARY KEY, title VARCHAR(64) NOT NULL, authors VARCHAR(128) DEFAULT NULL, publish_date VARCHAR(16) DEFAULT NULL, publishers VARCHAR(128) DEFAULT NULL, cover_path VARCHAR(64) NOT NULL);', () => {
            db.run('CREATE TABLE IF NOT EXISTS Review (isbn VARCHAR(13), user VARCHAR(20), stars TINYINT NOT NULL, text VARCHAR(256) DEFAULT NULL, date TEXT NOT NULL, PRIMARY KEY(isbn, user));', () => {
                populateDatabase();
            })
        });
    });
}

function populateDatabase()
{
    insertUser('1', 'utente1', 'https://avatars.githubusercontent.com/u/80161191?v=4');
    insertUser('2', 'utente2', 'https://avatars.githubusercontent.com/u/80161191?v=4');
    insertUser('3', 'utente3', 'https://avatars.githubusercontent.com/u/80161191?v=4');
    insertUser('4', 'utente4', 'https://avatars.githubusercontent.com/u/80161191?v=4');
    insertUser('5', 'utente5', 'https://avatars.githubusercontent.com/u/80161191?v=4');
    insertUser('6', 'utente6', 'https://avatars.githubusercontent.com/u/80161191?v=4');

    db.run('INSERT OR IGNORE INTO Book (isbn, title, authors, publish_date, publishers, cover_path) VALUES (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?)',
    [
        '1408294222', '1984', 'Michael Dean, George Orwell', '2008', 'Pearson Education', '/images/covers/isbn1408294222.jpg',
        '0395133408', 'The government of republican Italy', 'John Clarke Adams', '1972', 'Houghton Mifflin', '/images/covers/isbn0395133408.jpg',
        '0719043832', 'La luna e i falò', 'Pavese, Cesare.', '1994', 'Manchester University Press, Distributed exclusively in the USA and Canada by St. Martin\'s Press', '/images/covers/isbn0719043832.jpg'
    ]);

    db.run(`
    INSERT OR IGNORE INTO Review (isbn, user, stars, text, date)
    VALUES 
    -- Recensioni per il primo libro (isbn: '1408294222')
    ('1408294222', '1', 5, 'Libro fantastico, mi ha aperto la mente!', '23/09/2024, 09:30:45'),
    ('1408294222', '2', 4, 'Ottimo libro, ma alcuni punti non erano chiari.', '22/09/2024, 10:45:30'),
    ('1408294222', '3', 3, 'Buono, ma mi aspettavo di più.', '21/09/2024, 14:20:50'),
    ('1408294222', '4', 5, 'Capolavoro, uno dei miei preferiti.', '20/09/2024, 16:00:20'),
    ('1408294222', '5', 2, 'Non mi ha convinto del tutto.', '19/09/2024, 18:10:05'),
    ('1408294222', '6', 1, 'Non mi è piaciuto per niente.', '18/09/2024, 20:50:12'),

    -- Recensioni per il secondo libro (isbn: '0395133408')
    ('0395133408', '1', 4, 'Interessante punto di vista storico.', '22/09/2024, 12:10:25'),
    ('0395133408', '2', 3, 'Buono ma troppo tecnico in alcune parti.', '21/09/2024, 14:35:10'),
    ('0395133408', '3', 5, 'Un libro eccezionale sulla politica.', '20/09/2024, 15:55:05'),
    ('0395133408', '4', 4, 'Molto informativo e ben scritto.', '19/09/2024, 16:45:30'),
    ('0395133408', '5', 2, 'Non ho apprezzato lo stile di scrittura.', '18/09/2024, 17:55:45'),

    -- Recensioni per il terzo libro (isbn: '0719043832')
    ('0719043832', '1', 5, 'Un romanzo che ti cattura dall''inizio.', '22/09/2024, 08:25:50'),
    ('0719043832', '2', 3, 'Una buona lettura, ma un po'' troppo lenta.', '21/09/2024, 09:45:12'),
    ('0719043832', '3', 4, 'Ben scritto e coinvolgente.', '20/09/2024, 11:30:30'),
    ('0719043832', '4', 2, 'Non mi ha colpito particolarmente.', '19/09/2024, 13:40:25')
    `);
}

/**
 * Inserisci un nuovo utente
 */
function insertUser(id, username, profilePic)
{
    db.run('INSERT INTO User (id, username, profile_pic, is_mod) VALUES (?, ?, ?, ?)', [id, username, profilePic, false]);
}

/**
 * Per prendere informazioni di un utente tramite id
 */
async function getUser(id)
{
    return new Promise((resolve, reject) => {
        db.get(`SELECT * FROM User WHERE id = ?`, id, (err, row) => {
            if(err)
                reject(err);
            resolve(row);
        });
    });
}

/**
 * Per prendere informazioni di un utente tramite username
 */
async function getUserId(username)
{
    return new Promise((resolve, reject) => {
        db.get(`SELECT id FROM User WHERE username = ?`, username, (err, row) => {
            if(err) reject(err);
            resolve(row);
        });
    });
}

/**
 * Impostare un utente a moderatore o ad utente normale
 */
function updateUserIsMod(userId, isMod)
{
    db.run('UPDATE User SET is_mod = ? WHERE id = ?', [isMod ? 1 : 0, userId]);
}

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
        if(book.publish_date !== undefined && (typeof book.publish_date !== 'string' || book.publish_date.trim() === '')) throw new Error('Invalid publish date');
        if(book.publishers !== null && (typeof book.publishers !== 'string' || book.publishers.trim() === '')) throw new Error('Invalid publishers');
        if(typeof book.cover_path !== 'string' || book.cover_path.trim() === '') throw new Error('Invalid cover path');

        params.push(book.isbn, book.title, book.authors, book.publish_date, book.publishers, book.cover_path);
    }

    db.run(`INSERT OR IGNORE INTO Book (isbn, title, authors, publish_date, publishers, cover_path) VALUES ${'(?, ?, ?, ?, ?, ?)' + ', (?, ?, ?, ?, ?, ?)'.repeat(Object.keys(books).length - 1)}`, params);
}

/**
 * Vedere se un libro esiste gia'
 */
async function isBookNew(isbn)
{
    if(typeof isbn !== 'string' || !/^[0-9]{9}[0-9X]$/.test(isbn) && !/^[0-9]{13}$/.test(isbn)) throw new Error('Invalid ISBN');

    return new Promise((resolve, reject) => {
        db.get(`SELECT * FROM Book WHERE isbn = ?`, isbn, (err, row) => {
            if(err) reject(err);
            resolve(row === undefined);
        });
    });
}

/**
 * Per avere i tre libri piu' commentati
 */
async function getMostCommentedBooks()
{
    return new Promise((resolve, reject) => {
        db.all(`SELECT isbn FROM Review GROUP BY isbn ORDER BY COUNT(*) DESC LIMIT 3`, (err, rows) => {
            if (err) return reject(err);
            const isbns = rows.map(row => row.isbn);
            resolve(isbns);
        });
    });
}

/**
 * Filtrare i libri che non esistono ancora nel database
 */
async function filterNewBooks(isbns)
{
    const validIsbns = isbns.filter(isbn =>
        typeof isbn === 'string' && (/^[0-9]{9}[0-9X]$/.test(isbn) || /^[0-9]{13}$/.test(isbn))
    );

    return new Promise((resolve, reject) => {
        db.all(`SELECT isbn FROM Book WHERE isbn IN (${validIsbns.map(() => '?').join(',')})`, validIsbns, (err, rows) => {
            if (err) return reject(err);

            const existingIsbns = rows.map(row => row.isbn);
            const newIsbns = validIsbns.filter(isbn => !existingIsbns.includes(isbn));

            resolve(newIsbns);
        });
    });
}

/**
 * Prendere libri dal database
 */
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

/**
 * Inserire una recensione
 */
function insertReview(isbn, user, stars, text)
{
    if(typeof isbn !== 'string' || !/^[0-9]{9}[0-9X]$/.test(isbn) && !/^[0-9]{13}$/.test(isbn)) throw new Error('Invalid ISBN');
    if(typeof user !== 'string') throw new Error('Invalid user');
    if(typeof stars !== 'number' || stars < 1 || stars > 5) throw new Error('Invalid stars');
    if(typeof text !== 'string' || text.length > 256) throw new Error('Invalid text');

    db.run('INSERT INTO Review (isbn, user, stars, text, date) VALUES (?, ?, ?, ?, ?)', [isbn, user, stars, text, new Intl.DateTimeFormat('it-IT', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    }).format(new Date())]);
}

/**
 * Controllare se un utente ha gia' recensito un libro
 */
async function doesReviewExists(isbn, user)
{
    if(typeof isbn !== 'string' || !/^[0-9]{9}[0-9X]$/.test(isbn) && !/^[0-9]{13}$/.test(isbn)) throw new Error('Invalid ISBN');

    return new Promise((resolve, reject) => {
        db.get(`SELECT * FROM Review WHERE isbn = ? AND user = ?`, [isbn, user], (err, row) => {
            if(err) reject(err);
            resolve(row !== undefined);
        });
    });
}

/**
 * Per cancellare la recensione di un utente
 */
function deleteReview(isbn, user)
{
    if(typeof isbn !== 'string' || !/^[0-9]{9}[0-9X]$/.test(isbn) && !/^[0-9]{13}$/.test(isbn)) throw new Error('Invalid ISBN');

    db.run('DELETE FROM Review WHERE isbn = ? AND user = ?', [isbn, user]);
}

/**
 * Restituisce tutte le recensioni di un libro
 */
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

/**
 * Restituisce libri con titolo simile a quello passato.
 * Non e' piu' in uso questa funzione.
 */
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
    insertUser,
    getUser,
    getUserId,
    updateUserIsMod,
    getBooks,
    getMostCommentedBooks,
    insertBooks,
    insertReview,
    getReviews,
    doesReviewExists,
    deleteReview,
    filterNewBooks
};