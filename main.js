import { readFileSync, createWriteStream } from "fs";
import { parse } from "csv-parse/sync";
import PDFDocument from 'pdfkit';

// Give drinks more concise names for labelling
const drink_list = {
    "softdrinks": {
        "Coca Cola (330ml)": {"name": "COKE", "type": "COLD"},
        "Diet Coke (330ml)": {"name": "DIET COKE", "type": "COLD"},
        "Fanta Orange (330ml)": {"name": "FANTA ORANGE", "type": "COLD"},
        "7Up (330ml)": {"name": "7 UP", "type": "COLD"},
        "Water - Still (500ml)": {"name": "STILL WATER", "type": "COLD"},
        "Water - Sparkling (500ml)": {"name": "SPARKLING WATER", "type": "COLD"},
        "Orange Juice (200ml)": {"name": "ORANGE JUICE", "type": "COLD"},
        "Apple Juice (200ml)": {"name": "APPLE JUICE", "type": "COLD"},
        "Schweppes Tonic Water (200ml)": {"name": "TONIC WATER", "type": "COLD"},
        "R Whites Lemonade": {"name": "WHITES LEMONADE", "type": "COLD"}
    },
    "wines": {
        "Cabernet Sauvignon (12.5% vol)": {"name": "CAB SAUV", "type": "WARM"},
        "Merlot (12.5% vol)": {"name": "MERLOT", "type": "WARM"},
        "Pinot Grigio (12% vol)": {"name": "PINOT G", "type": "COLD"},
        "Sauvignon Blanc (12.5% vol)": {"name": "SAUV BLANC", "type": "COLD"},
        "White Zinfandel (11.5% vol)": {"name": "WHITE ZINF", "type": "COLD"}
    },
    "ciders": {
        "Sweet Cider (5.8% vol)": {"name": "SWEET CIDER", "type": "COLD"},
        "Medium Cider (5.8% vol)": {"name": "MED CIDER", "type": "COLD"},
        "Dry Cider (5.8% vol)": {"name": "DRY CIDER", "type": "COLD"}
    },
    "ales": {
        "Steam IPA (4.6% vol)": {"name": "STEAM IPA", "type": "WARM"},
        "Copper Top Blonde (3.5% vol)": {"name": "COPPER TOP", "type": "WARM"},
        "Shunters Best Bitter (4.2% vol)": {"name": "SHUNTERS", "type": "WARM"}
    },
    "spirits": {
        "Smirnoff Vodka (37.5% vol)": {"name": "VODKA", "type": "WARM"},
        "Bacardi White Rum (37.5% vol)": {"name": "RUM", "type": "WARM"},
        "Gordon's Gin (37.5% vol)": {"name": "GIN", "type": "WARM"},
        "Gordon's Pink Gin (37.5% vol)": {"name": "PINK GIN", "type": "WARM"},
        "Jacobite Whisky (40% vol)": {"name": "WHISKY", "type": "WARM"},
    },
    "specials": {
        "Prosecco (20cl Bottle)": {"name": "SMALL PROSECCO", "type": "COLD"},
        "Prosecco (75cl Bottle)": {"name": "LARGE PROSECCO", "type": "COLD"}
    }
};

// Import CSV
function load_csv(csv_path) {
    const fh = readFileSync(csv_path);
    let records = parse(fh, {
        columns: true,
        skip_empty_lines: true,
        from_line: 3,
        bom: true
    });
    records = records.slice(1);
    records = records.sort((a, b) => parseInt(a["Table Number(s)"].split(",")[0]) - parseInt(b["Table Number(s)"].split(",")[0]));
    for(const record of records) {
        record.Customers = record.Customers.replace("Bottles", "Bottle");
    };
    return records;
};

// Generate table list
function populate_tables(records, drink_list) {
    const tables = [];

    function map_drinks(records, drink_list) {
        let drinks = [];
        if(records) {
            const items = records.split(/\,?\s(?=\d+\s)/g);
            drinks = items.reduce( (list, item) => {
                const quantity = item.split(" ")[0];
                const drink_name = item.replace(/^\d+\s/, "");
                const drink_item = drink_list[drink_name];
                if(drink_item) {
                    drink_item.qty = quantity;
                    list.push(drink_item);
                }
                return list;
            }, []);
        }
        return drinks;
    }

    for(const record of records) {
        const table_nums = record["Table Number(s)"].split(",");
        const table = {
            number: table_nums[0],
            plus_tables: table_nums.slice(1),
            name: record["Contact"],
            pax: record["Pax"],
            notes: record["Notes"],
            soft_drinks: map_drinks(record["Soft Drink List"], drink_list.softdrinks),
            wines: map_drinks(record["Wine List"], drink_list.wines),
            ciders: map_drinks(record["Cider List"], drink_list.ciders),
            ales: map_drinks(record["Ale List"], drink_list.ales),
            spirits: map_drinks(record["Spirit List"], drink_list.spirits),
            specials: map_drinks(record["Customers"], drink_list.specials)
        };
        tables.push(JSON.parse(JSON.stringify(table))); // Deep copy
    }
    return tables;
}

// Generate carriage ends drinks lists
function gen_crate_labels(tables) {
    const ranges = [
        {coach: "A", coach_end:"Lydney", start: 1, end: 7, tables: [], colddrinks: [], warmdrinks: []},
        {coach: "A", coach_end:"Parkend", start: 8, end: 16, tables: [], colddrinks: [], warmdrinks: []},
        {coach: "C", coach_end:"Lydney", start: 17, end: 24, tables: [], colddrinks: [], warmdrinks: []},
        {coach: "C", coach_end:"Parkend", start: 25, end: 32, tables: [], colddrinks: [], warmdrinks: []},
        {coach: "D", coach_end:"Lydney", start: 33, end: 40, tables: [], colddrinks: [], warmdrinks: []},
        {coach: "D", coach_end:"Parkend", start: 43, end: 48, tables: [], colddrinks: [], warmdrinks: []}, 
    ];
    for(const table of tables) {
        for(const range of ranges) {
            if(table.number >= range.start && table.number <= range.end) {
                //range.tables.push(JSON.parse(JSON.stringify(table)));
                range.warmdrinks.push(table.soft_drinks.filter(drink => drink.type=="WARM"))
                range.warmdrinks.push(table.wines.filter(drink => drink.type=="WARM"))
                range.warmdrinks.push(table.ciders.filter(drink => drink.type=="WARM"))
                range.warmdrinks.push(table.ales.filter(drink => drink.type=="WARM"))
                range.warmdrinks.push(table.spirits.filter(drink => drink.type=="WARM"))
                range.warmdrinks.push(table.specials.filter(drink => drink.type=="WARM"))
                range.colddrinks.push(table.soft_drinks.filter(drink => drink.type=="COLD"))
                range.colddrinks.push(table.wines.filter(drink => drink.type=="COLD"))
                range.colddrinks.push(table.ciders.filter(drink => drink.type=="COLD"))
                range.colddrinks.push(table.ales.filter(drink => drink.type=="COLD"))
                range.colddrinks.push(table.spirits.filter(drink => drink.type=="COLD"))
                range.colddrinks.push(table.specials.filter(drink => drink.type=="COLD"))
            }
        }
    }
    for(const range of ranges) {
        const cold_counts = {};
        for(const block of range.colddrinks) {
            for(const item of block) {
                if(item) {
                    cold_counts[item.name] = (cold_counts[item.name] || 0) + parseInt(item.qty);
                }
            }
        }
        range.colddrinks = cold_counts;
        const warm_counts = {};
        for(const block of range.warmdrinks) {
            for(const item of block) {
                if(item) {
                    warm_counts[item.name] = (warm_counts[item.name] || 0) + parseInt(item.qty);
                }
            }
        }
        range.warmdrinks = warm_counts;
    }
    return ranges;
}

// Produce table pdf
function print_tables(tables) {
    const doc = new PDFDocument({size: 'A5', autoFirstPage: false});
    doc.pipe(createWriteStream('Tables.pdf'));
    doc.fontSize(20);
    
    for(const table of tables) {
        const sanitised_name = table.name.split(" ").reduce((p, c, i, a) => {
            if(i == a.length-1) {
                return [p, c.toUpperCase()].join(" ")
             } else return p;
        });
        doc
            .addPage()
            .font('Helvetica-Bold')
            .fontSize(32)
            .text(`Table: ${table.number}`)
            .font('Helvetica')
            .fontSize(20)
            .moveDown();

        if(table.plus_tables.length>0){
            doc.text(`Includes tables: ${table.plus_tables}`);
        }
        doc
            .text(`Contact: ${sanitised_name}`)
            .text(`Group size: ${table.pax}`);
        if(table.notes != ""){
            doc.text(`Notes: ${table.notes}`);
        }
        doc.moveDown();
        for(const drink_type of ["soft_drinks", "wines", "ciders", "ales", "spirits", "specials"]) {
            for(const item of table[drink_type]) {
                if(item.type == "WARM") {
                    doc.fillColor("red");
                } else {
                    doc.fillColor("blue");
                }
                doc.text([item.qty, item.name].join(" of "));
            }
        }
    }
    
    doc.end();
}

// Produce crate labels pdf
function print_crate_labels(crate_labels) {
    const doc = new PDFDocument({size: 'A5', autoFirstPage: false});
    doc.pipe(createWriteStream('Crates.pdf'));
    doc.fontSize(20);
    
    for(const crate_label of crate_labels) {
        doc
            .addPage()
            .font('Helvetica-Bold')
            .fontSize(40)
            .text(`Coach: ${crate_label.coach}`)
            .text(`(${crate_label.coach_end} end)`)
            .font('Helvetica')
            .fontSize(18);
        for(const [item, qty] of Object.entries(crate_label.warmdrinks)) {
            doc.text([qty, item].join(" of "));
        }
        doc.save();
        doc.rotate(90).fontSize(36).fillColor("red").text("WARM DRINKS", 80, -380).fontSize(20).fillColor("black");
        doc.restore();
        doc
            .addPage()
            .font('Helvetica-Bold')
            .fontSize(40)
            .text(`Coach: ${crate_label.coach}`)
            .text(`(${crate_label.coach_end} end)`)
            .font('Helvetica')
            .fontSize(18);
        for(const [item, qty] of Object.entries(crate_label.colddrinks)) {
            doc.text([qty, item].join(" of "));
        }
        doc.save();
        doc.rotate(90).fontSize(36).fillColor("blue").text("COLD DRINKS", 80, -380).fontSize(20).fillColor("black");
        doc.restore();
    }
    
    doc.end();
}

// Print a summary list as backup.
function print_summary_list(tables) {
    const doc = new PDFDocument({size: 'A4'});
    doc.pipe(createWriteStream('Summary.pdf'));
    doc.fontSize(12);
    
    for(const table of tables) {
        doc.fontSize(20).text(" ", {continued: true, baseline: "hanging"}).fontSize(12);
        doc.text("Table: ", {continued: true});
        doc.fontSize(20).text(table.number, {continued: true, baseline: "hanging"}).fontSize(12);
        doc.text(`, Contact: ${table.name}, Group size: ${table.pax}`, {baseline: "top"});
        if(table.plus_tables.length>0){
            doc.text(`Includes tables: ${table.plus_tables}`, {oblique: true});
        }
        if(table.notes != ""){
            doc.text(`Notes: ${table.notes}`, {oblique: true});
        }
        doc.moveDown(0.5);
        for(const drink_type of ["soft_drinks", "wines", "ciders", "ales", "spirits", "specials"]) {
            for(const item of table[drink_type]) {
                if(item.type == "WARM") {
                    doc.fillColor("red");
                } else {
                    doc.fillColor("blue");
                }
                doc.text([item.qty, item.name].join(" of ") + ", ", {continued: true});
            }
        }
        doc.fillColor("black");
        doc.text(" ");
        doc.moveDown();
    }
    doc.end();
}

// Wrap it all up
function labels_from_csv(csv_path) {
    const records = load_csv(csv_path);
    const tables = populate_tables(records, drink_list);
    const crate_labels = gen_crate_labels(tables);
    print_tables(tables);
    print_crate_labels(crate_labels);
    print_summary_list(tables);
};

export default labels_from_csv;

labels_from_csv("data.csv");