import {defineField, defineType} from 'sanity';

// Maintained by the owner admin API at one fixed ID. Product values remain strings.
export const catalogOptions = defineType({
  name: 'catalogOptions',
  title: 'אפשרויות הקטלוג',
  type: 'document',
  readOnly: true,
  fields: [
    defineField({name:'sizes', title:'מידות', type:'array', of:[{type:'string'}]}),
    defineField({name:'colors', title:'צבעים', type:'array', of:[{type:'string'}]})
  ],
  preview: {prepare: () => ({title:'אפשרויות הקטלוג', subtitle:'ניהול דרך ממשק החנות'})}
});
